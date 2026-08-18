import React from 'react';
import { ArrowDownRight, ArrowUpRight, Sprout, X } from 'lucide-react';
import { type Plant } from '../types';
import { getGrowthStage, getHealthState, getTenureDays, getSpeciesFamily } from '../lib/gardenUtils';
import { money, signedMoney, tenureLabel } from '../lib/format';

interface PlantDetailDrawerProps {
  plant: Plant | null;
  onClose: () => void;
}

export const PlantDetailDrawer: React.FC<PlantDetailDrawerProps> = ({
  plant,
  onClose,
}) => {
  if (!plant) return null;

  const tenureDays = getTenureDays(plant.started);
  const stage = getGrowthStage(tenureDays);
  const health = getHealthState(plant);
  const species = getSpeciesFamily(plant.plan);

  const tenureStr = tenureLabel(tenureDays);
  // Newest first: what it did last is what you want to know first.
  const history = [...(plant.changes ?? [])].reverse();

  const initials = plant.customer_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="fixed bottom-5 right-5 z-40 w-full max-w-sm bg-surface backdrop-blur-md border border-hairline rounded-[20px] shadow-panel p-4 text-ink animate-in fade-in slide-in-from-bottom-4 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-hairline">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-xl bg-garden text-garden-ink flex items-center justify-center shrink-0">
            <Sprout className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs text-ink">
            Specimen Details
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-xl hover:bg-inset text-ink-faint hover:text-ink-soft cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {/* Customer Header Card */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-inset border border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-garden text-garden-ink font-bold text-xs flex items-center justify-center shadow-xs">
              {initials}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-ink leading-tight">
                  {plant.customer_name}
                </span>
                {plant.countryFlag && (
                  <span className="text-sm leading-none" title={plant.countryName}>
                    {plant.countryFlag}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-ink-faint font-mono">
                {plant.subscription_id} • {plant.countryName || 'United States'}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-lg bg-garden-wash text-garden-soft font-bold text-[10px]">
            {plant.plan}
          </span>
        </div>

        {/* Specimen Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-inset rounded-2xl border border-hairline flex flex-col">
            <span className="text-[9px] font-bold text-ink-faint uppercase">
              Flora Family
            </span>
            <span className="font-bold text-ink text-xs mt-0.5">
              {species}
            </span>
            <span className="text-[9px] text-garden-soft font-medium capitalize">
              {stage}
            </span>
          </div>

          <div className="p-2.5 bg-inset rounded-2xl border border-hairline flex flex-col">
            <span className="text-[9px] font-bold text-ink-faint uppercase">
              Tenure / Age
            </span>
            <span className="font-bold text-ink text-xs mt-0.5">
              {tenureStr}
            </span>
            <span className="text-[9px] text-ink-faint font-medium">
              Started {new Date(plant.started).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          </div>

          <div className="p-2.5 bg-inset rounded-2xl border border-hairline flex flex-col">
            <span className="text-[9px] font-bold text-ink-faint uppercase">
              Monthly Value
            </span>
            <span className="font-bold text-ink text-xs mt-0.5">
              {money(plant.mrr)} <span className="text-[9px] text-ink-faint">/mo</span>
            </span>
          </div>

          <div className="p-2.5 bg-inset rounded-2xl border border-hairline flex flex-col">
            <span className="text-[9px] font-bold text-ink-faint uppercase">
              Health
            </span>
            <span
              className={`font-bold text-xs mt-0.5 capitalize ${
                health === 'healthy'
                  ? 'text-garden-soft'
                  : health === 'yellowing'
                  ? 'text-warn-ink'
                  : 'text-danger-ink'
              }`}
            >
              {health}
            </span>
          </div>
        </div>

        {/* Plan history — where this account's expansion or contraction came
            from. Without it the canopy is simply a size, with no account of
            how it got there. */}
        {history.length > 0 && (
          <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-inset p-2.5">
            <span className="text-[9px] font-bold uppercase text-ink-faint">Plan history</span>
            {history.map((change) => {
              const isUpgrade = change.toMrr >= change.fromMrr;
              const Icon = isUpgrade ? ArrowUpRight : ArrowDownRight;
              return (
                <div key={change.at} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Icon className={`h-3.5 w-3.5 ${isUpgrade ? 'text-garden-soft' : 'text-danger-ink'}`} />
                    {change.fromPlan} → {change.toPlan}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span className={isUpgrade ? 'font-bold text-garden-soft' : 'font-bold text-danger-ink'}>
                      {signedMoney(change.toMrr - change.fromMrr)}
                    </span>
                    <span className="text-ink-faint">
                      {new Date(change.at).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                    </span>
                  </span>
                </div>
              );
            })}
            <span className="text-[10px] text-ink-faint">
              Signed up on {history[history.length - 1].fromPlan} at {money(history[history.length - 1].fromMrr)}/mo.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
