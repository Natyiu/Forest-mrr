import React from 'react';
import { X } from 'lucide-react';
import { Hotkey, comboLabel } from '../../lib/useHotkeys';
import { getSpeciesFamily } from '../../lib/gardenUtils';
import { largestPlan, planNames, smallestPlan } from '../../lib/plans';

/**
 * How to read the garden, and how to drive it.
 *
 * Lifted out of App.tsx, where it was 25 lines of inline markup wedged between
 * the other modals, and turned into the list of rules it always was. The
 * shortcut table is not written here — it is rendered from the same bindings
 * the app actually registers, so a key that works is documented and a key that
 * is documented works.
 */

/**
 * What plan looks like, in this product's own plans.
 *
 * Written out rather than listed as four names, because the guide is the one
 * place a reader is told what the encoding *is*, and a sentence naming plans
 * they do not sell teaches them to distrust the rest of it. Built at render
 * time: the catalogue can arrive from the server after this module loads.
 */
function foliageBody(): string {
  const ladder = planNames();
  const species = ladder.map((plan) => `${plan} is ${getSpeciesFamily(plan).toLowerCase()}`);
  const list =
    species.length > 1
      ? `${species.slice(0, -1).join(', ')} and ${species[species.length - 1]}`
      : species[0];
  const deepening =
    ladder.length > 1
      ? ` — and the foliage deepens with the plan, palest at ${smallestPlan()} through darkest at ${largestPlan()}. The filter chips carry the same greens, so the key is on the plot.`
      : '.';
  return `${list}${deepening} Failed payments still leave the green altogether.`;
}

const rules = (): Array<{ title: string; body: string }> => [
  {
    title: 'Tenure is height',
    body: 'Plants grow through six stages — seed, sprout, young, established, mature, ancient.',
  },
  {
    title: 'Plan is species, and the green it is',
    body: foliageBody(),
  },
  {
    title: 'Failed payments yellow the leaves',
    body: 'Yellowing, then wilting, then browning. Recovery greens it back with a bloom. Churn leaves a stump for 30 days.',
  },
  {
    title: 'Payments are weather',
    body: 'Payments fall as rain, a whale payment casts a sunbeam, and a quiet stretch brings drought.',
  },
  {
    title: 'The bar at the bottom is time',
    body: 'Scrub the year to watch cohorts arrive, grow and churn. Press play to run it.',
  },
  {
    title: 'The border bed is a menu',
    body: 'Beside the plot stands one labelled specimen per metric — retention, churn, quick ratio, concentration — sized by how much there is and coloured green, amber or red by whether that is good. Click one and the whole plot re-beds itself as that metric: net retention becomes last month\u2019s customers sorted into what became of them, concentration lifts the ten largest accounts into their own bed. A tree is always a subscription; only its bed changes.',
  },
  {
    title: 'The plot dresses for the month',
    body: 'Blossom in spring, pollen in summer, leaf-fall in autumn, snow in winter. It follows the timeline unless you pin a season under Appearance.',
  },
];

export const GuideModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  hotkeys: Hotkey[];
}> = ({ isOpen, onClose, hotkeys }) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to read the garden"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-hairline bg-surface-solid p-6 shadow-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-ink">How to read the garden</h2>
            <p className="mt-1 text-[13px] text-ink-faint">Every subscription is a plant.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-inset hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="mt-5 flex flex-col gap-4">
          {rules().map((rule, index) => (
            <li key={rule.title} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent-wash text-[12px] font-bold text-accent-soft">
                {index + 1}
              </span>
              <span>
                <span className="block text-[13px] font-bold text-ink">{rule.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-soft">{rule.body}</span>
              </span>
            </li>
          ))}
        </ul>

        {hotkeys.length > 0 && (
          <section className="mt-6 border-t border-hairline pt-4">
            <h3 className="text-[13px] font-bold text-ink">Keyboard</h3>
            <dl className="mt-2.5 flex flex-col gap-1.5">
              {hotkeys.map((hotkey) => (
                <div key={hotkey.combo} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-ink-soft">{hotkey.label}</dt>
                  <dd>
                    <kbd className="rounded-md border border-hairline bg-inset px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                      {comboLabel(hotkey.combo)}
                    </kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
};
