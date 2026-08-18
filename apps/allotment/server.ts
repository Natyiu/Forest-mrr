import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { generateGarden } from './src/lib/mockData';
import {
  largestPlan,
  middlePlan,
  nextPlanUp,
  parsePlanCatalogue,
  planBaseMrr,
  planCount,
  planNames,
  plans,
  setPlanCatalogue,
  tierOfPlan,
} from './src/lib/plans';
import { GardenState, PaymentEvent, PlanTier, Plant, WeatherState } from './src/types';

async function startServer() {
  const app = express();
  // Overridable so a second instance can run beside a dev server already
  // holding 3000, which is otherwise a hard crash on startup.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- The plan ladder ---
  //
  // Whatever this product sells, declared once and read by everything: the
  // generated book, the sprite sizes, the foliage ramp, the filter chips, the
  // upgrade ladder below. Set `ALLOTMENT_PLANS` to a JSON array of
  // `{ name, baseMrr, accounts: [min, max] }`, cheapest first — two plans,
  // three, five, under any names. Absent, the four-rung default stands.
  //
  // Installed *before* the book is generated, and shipped with it in
  // `/api/garden`, so the client draws the same ladder the server dealt.
  // A malformed catalogue crashes the boot rather than quietly serving a
  // different dashboard from the one that was configured.
  const configured = parsePlanCatalogue(process.env.ALLOTMENT_PLANS);
  if (configured) setPlanCatalogue(configured);
  console.log(`[allotment] ${planCount()} plans: ${planNames().join(' → ')}`);

  // Memory Garden State & Snapshots. One book of business sampled at many
  // dates, so the plot the client draws for "today" is the last month of the
  // timeline it scrubs — not a second, unrelated roll of the dice.
  const { garden, snapshots: historicalSnapshots } = generateGarden(Date.now());
  let gardenState: GardenState = garden;

  let weatherState: WeatherState = {
    rainIntensity: 14,
    sunbeamPlantId: null,
    sunbeamAmount: null,
    cloudShadow: false,
    drought: false,
    season: 'summer',
    lastPaymentTime: Date.now(),
  };

  // SSE Clients for real-time weather & payment events
  const sseClients: express.Response[] = [];

  function broadcastSSE(event: string, data: any) {
    sseClients.forEach((client) => {
      client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
  }

  // --- API ROUTES ---

  // GET /api/garden
  //
  // The catalogue rides with the book. A client that took the subscriptions
  // without it would be holding plan names it has no rung for.
  app.get('/api/garden', (req, res) => {
    res.json({ gardenState, weatherState, planCatalogue: plans() });
  });

  // GET /api/plans — the ladder on its own, for anything that only needs it.
  app.get('/api/plans', (req, res) => {
    res.json({ plans: plans() });
  });

  // GET /api/garden/history
  app.get('/api/garden/history', (req, res) => {
    res.json({ snapshots: historicalSnapshots });
  });

  // GET /api/stream (SSE)
  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // POST /api/simulate-event
  app.post('/api/simulate-event', (req, res) => {
    const { type, data } = req.body;
    const eventId = `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (type === 'payment' || type === 'invoice.payment_succeeded') {
      weatherState.rainIntensity = Math.min(50, weatherState.rainIntensity + 6);
      weatherState.lastPaymentTime = Date.now();
      weatherState.drought = false;

      // Find target plant or recover past due plant
      const pastDue = gardenState.plants.find((p) => p.status === 'past_due');
      if (pastDue) {
        pastDue.status = 'active';
        pastDue.failed_attempts = 0;
        pastDue.last_payment = Date.now();
        pastDue.floweringUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        if (gardenState.atRiskCount > 0) gardenState.atRiskCount--;
      } else {
        const targetName = data?.customer_name;
        const target = targetName
          ? gardenState.plants.find((p) => p.customer_name === targetName)
          : gardenState.plants[Math.floor(Math.random() * gardenState.plants.length)];
        if (target) {
          target.last_payment = Date.now();
          target.floweringUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
        }
      }

      const event: PaymentEvent = {
        id: eventId,
        type: 'payment',
        subscription_id: data?.subscription_id || 'sub_demo',
        customer_name: data?.customer_name || 'Acme Corp',
        plan: data?.plan || middlePlan(),
        amount: data?.amount || planBaseMrr(middlePlan()),
        timestamp: Date.now(),
      };
      broadcastSSE('payment_event', event);
    } else if (type === 'sunbeam' || type === 'whale_payment') {
      // A whale is somebody near the top of the ladder — the dearest third of
      // it, so the pick still means something on a two-plan book.
      const topThird = (planCount() - 1) * (2 / 3);
      const whales = gardenState.plants.filter((p) => tierOfPlan(p.plan) >= topThird);
      const targetPlant = whales.length > 0
        ? whales[Math.floor(Math.random() * whales.length)]
        : gardenState.plants[Math.floor(Math.random() * gardenState.plants.length)];

      weatherState.sunbeamPlantId = targetPlant?.subscription_id || null;
      weatherState.sunbeamAmount = 2400;

      broadcastSSE('weather_event', { type: 'sunbeam', plantId: targetPlant?.subscription_id });

      setTimeout(() => {
        weatherState.sunbeamPlantId = null;
        broadcastSSE('weather_event', { type: 'sunbeam_clear' });
      }, 5000);
    } else if (type === 'invoice.payment_failed') {
      const activePlants = gardenState.plants.filter((p) => p.status === 'active');
      const targetName = data?.customer_name;
      const target = targetName
        ? gardenState.plants.find((p) => p.customer_name === targetName)
        : (activePlants.length > 0 ? activePlants[Math.floor(Math.random() * activePlants.length)] : gardenState.plants[0]);

      if (target) {
        if (target.status !== 'past_due') {
          target.status = 'past_due';
          gardenState.atRiskCount++;
        }
        target.failed_attempts = Math.min(3, target.failed_attempts + 1);
        broadcastSSE('plant_update', { plant: target, event: 'yellowing' });
      }
    } else if (type === 'recovery') {
      const pastDue = gardenState.plants.filter((p) => p.status === 'past_due');
      if (pastDue.length > 0) {
        const target = pastDue[0];
        target.status = 'active';
        target.failed_attempts = 0;
        target.floweringUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        if (gardenState.atRiskCount > 0) gardenState.atRiskCount--;

        broadcastSSE('plant_update', { plant: target, event: 'recovery' });
      }
    } else if (type === 'customer.subscription.created') {
      const planName: PlanTier = data?.plan || middlePlan();
      const tierVal = tierOfPlan(planName);
      const mrrVal = data?.mrr || planBaseMrr(planName);

      const newPlant: Plant = {
        subscription_id: `sub_new_${Date.now()}`,
        customer_id: `cus_new_${Date.now()}`,
        customer_name: data?.customer_name || 'Apex Systems',
        started: Date.now(),
        plan: planName,
        tier: tierVal,
        mrr: mrrVal,
        status: 'active',
        failed_attempts: 0,
        last_payment: Date.now(),
        cohort: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        floweringUntil: Date.now() + 5 * 24 * 60 * 60 * 1000,
      };

      gardenState.plants.unshift(newPlant);
      gardenState.activeCount++;
      gardenState.mrr += newPlant.mrr;

      broadcastSSE('plant_created', { plant: newPlant });
    } else if (type === 'customer.subscription.updated') {
      // Upgrade plant
      const targetName = data?.customer_name;
      const target = targetName
        ? gardenState.plants.find((p) => p.customer_name === targetName)
        : gardenState.plants[Math.floor(Math.random() * gardenState.plants.length)];

      if (target) {
        // One rung up, whatever the rungs are. An account already at the top
        // has nothing to upgrade to, and inventing a move for it would post an
        // expansion the book cannot reconcile.
        const nextPlan = nextPlanUp(target.plan) ?? (largestPlan() === target.plan ? null : largestPlan());
        if (nextPlan) {
          target.plan = nextPlan;
          target.tier = tierOfPlan(nextPlan);
          const oldMrr = target.mrr;
          target.mrr = planBaseMrr(nextPlan);
          gardenState.mrr += (target.mrr - oldMrr);
          target.floweringUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;

          broadcastSSE('plant_update', { plant: target, event: 'upgrade' });
        }
      }
    } else if (type === 'customer.subscription.deleted') {
      // Churn subscription -> turn into stump
      const targetName = data?.customer_name;
      const activePlants = gardenState.plants.filter((p) => p.status !== 'canceled');
      const target = targetName
        ? gardenState.plants.find((p) => p.customer_name === targetName && p.status !== 'canceled')
        : (activePlants.length > 0 ? activePlants[Math.floor(Math.random() * activePlants.length)] : null);

      if (target) {
        const wasPastDue = target.status === 'past_due';
        target.status = 'canceled';
        target.canceled_at = Date.now();
        if (wasPastDue && gardenState.atRiskCount > 0) {
          gardenState.atRiskCount--;
        }
        if (gardenState.activeCount > 0) gardenState.activeCount--;
        gardenState.mrr = Math.max(0, gardenState.mrr - target.mrr);

        broadcastSSE('plant_update', { plant: target, event: 'churn' });
      }
    }

    res.json({ success: true, weatherState, gardenState });
  });

  // Periodic weather decay
  setInterval(() => {
    if (weatherState.rainIntensity > 0) {
      weatherState.rainIntensity = Math.max(0, weatherState.rainIntensity - 1);
    }
    const hoursSincePayment = (Date.now() - weatherState.lastPaymentTime) / (1000 * 60 * 60);
    if (hoursSincePayment >= 6) {
      weatherState.drought = true;
    }
  }, 10000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Allotment server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
