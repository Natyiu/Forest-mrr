import React from 'react';
import { useEscapeToClose, backdropProps } from './hud/ui';
import { X, Sparkles, AlertTriangle, CheckCircle2, Droplets, Sun, Zap, RefreshCw, ArrowRight } from 'lucide-react';
import { GardenState, WeatherState } from '../types';
import { largestPlan } from '../lib/plans';

interface GardenAdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gardenState: GardenState;
  weatherState: WeatherState;
  onTriggerPaymentRain: () => void;
  onTriggerWhalePayment: () => void;
  onTriggerDunningFailure: () => void;
  onTriggerRecovery: () => void;
}

export const GardenAdvisorDrawer: React.FC<GardenAdvisorDrawerProps> = ({
  isOpen,
  onClose,
  gardenState,
  weatherState,
  onTriggerPaymentRain,
  onTriggerWhalePayment,
  onTriggerDunningFailure,
  onTriggerRecovery,
}) => {
  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  // Compute garden diagnostic scores
  const total = gardenState.activeCount + gardenState.atRiskCount;
  const healthPercent = total > 0 ? Math.round((gardenState.activeCount / total) * 100) : 100;

  // Diagnostics items
  const insights: Array<{
    type: 'critical' | 'warning' | 'good';
    title: string;
    description: string;
    actionText?: string;
    actionFn?: () => void;
  }> = [];

  if (gardenState.atRiskCount > 0) {
    insights.push({
      type: 'warning',
      title: `${gardenState.atRiskCount} Plants Wilting from Dunning Failures`,
      description: `Subscriptions with failed invoice attempts are yellowing/wilting. Recover them before churn occurs to save MRR.`,
      actionText: 'Trigger Recovery Sequence',
      actionFn: onTriggerRecovery,
    });
  } else {
    insights.push({
      type: 'good',
      title: 'Zero Active Dunning Failures',
      description: 'All allotments are hydrated with successful recurring payment invoices!',
    });
  }

  if (weatherState.drought || weatherState.rainIntensity < 5) {
    insights.push({
      type: 'warning',
      title: 'Low Payment Velocity (Quiet Period)',
      description: 'Payment rain is low. Water the allotment plot with a new invoice batch.',
      actionText: 'Trigger Payment Rain',
      actionFn: onTriggerPaymentRain,
    });
  } else {
    insights.push({
      type: 'good',
      title: `High Payment Velocity (${weatherState.rainIntensity} payments/hr)`,
      description: 'Payment rain is nourishing all active plan beds.',
    });
  }

  insights.push({
    type: 'good',
    title: `${largestPlan()} Accounts Thriving`,
    description: `The biggest ${largestPlan()} plants shade the whole plot. Trigger a whale payment to illuminate it.`,
    actionText: 'Cast Whale Sunbeam',
    actionFn: onTriggerWhalePayment,
  });

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-surface-solid shadow-modal border-l border-hairline p-5 flex flex-col justify-between text-ink transition-all animate-in slide-in-from-right duration-200">
      <div className="flex flex-col gap-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent-wash text-accent-soft">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-ink tracking-tight">
                GARDEN ADVISOR
              </h3>
              <p className="text-[10px] text-ink-faint font-medium">
                Real-time Revenue Diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-inset text-ink-faint hover:text-ink-soft cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Overall Health Card */}
        <div className="p-3.5 bg-accent-wash rounded-2xl border border-accent-line flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent-soft">
              Overall Garden Vitality
            </span>
            <span className="text-sm font-black text-accent-soft">
              {healthPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-accent-wash rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${healthPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-semibold text-accent-soft pt-0.5">
            <span>{gardenState.activeCount} Healthy Plants</span>
            <span>{gardenState.atRiskCount} At Risk</span>
          </div>
        </div>

        {/* Diagnostic Insights List */}
        <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[55vh] pr-1">
          {insights.map((insight, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                insight.type === 'warning'
                  ? 'bg-warn-wash/70 border-warn-line text-warn-ink'
                  : insight.type === 'critical'
                  ? 'bg-danger-wash border-danger-line text-danger-ink'
                  : 'bg-inset border-hairline text-ink'
              }`}
            >
              <div className="flex items-start gap-2">
                {insight.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-warn-ink shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-accent-soft shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col">
                  <span className="font-bold text-xs leading-tight">
                    {insight.title}
                  </span>
                  <span className="text-[11px] text-ink-soft font-normal leading-normal mt-0.5">
                    {insight.description}
                  </span>
                </div>
              </div>

              {insight.actionFn && (
                <button
                  onClick={insight.actionFn}
                  className="mt-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-surface-solid border border-hairline text-xs font-bold text-ink hover:bg-inset cursor-pointer shadow-2xs transition-all"
                >
                  <span>{insight.actionText}</span>
                  <ArrowRight className="w-3 h-3 text-accent-soft" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-hairline text-[10px] text-ink-faint text-center font-medium">
        Stripe Allotment Ecosystem • Auto-diagnosing every 60s
      </div>
    </div>
  );
};
