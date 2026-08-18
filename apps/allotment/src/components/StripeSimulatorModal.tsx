import React, { useState } from 'react';
import { useEscapeToClose, backdropProps } from './hud/ui';
import { X, Key, Zap, CheckCircle2, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { PlanTier } from '../types';
import { middlePlan, planBaseMrr, planNames } from '../lib/plans';

interface StripeSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateWebhook: (type: string, data: any) => void;
  stripeApiKey: string;
  onSaveStripeKey: (key: string) => void;
}

export const StripeSimulatorModal: React.FC<StripeSimulatorModalProps> = ({
  isOpen,
  onClose,
  onSimulateWebhook,
  stripeApiKey,
  onSaveStripeKey,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(stripeApiKey);
  // The middle of the ladder, at its own price — a simulator that defaults to
  // a plan and a number that disagree teaches the reader the wrong pairing.
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(() => middlePlan());
  const [customerName, setCustomerName] = useState('Acme Technologies');
  const [customMrr, setCustomMrr] = useState(() => String(planBaseMrr(middlePlan())));

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim backdrop-blur-xs p-4" {...backdropProps(onClose)}>
      <div className="relative w-full max-w-md bg-surface-solid rounded-2xl shadow-modal border border-hairline p-5 text-ink animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-accent-wash text-accent-soft border border-accent-line">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <h3 className="font-bold text-sm text-ink tracking-tight">
              Stripe Webhook & API Key Manager
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-inset text-ink-faint hover:text-ink-soft cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5 flex flex-col gap-3 text-xs">
          {/* Live Stripe API Key Section */}
          <div className="bg-accent-wash/50 p-3 rounded-xl border border-accent-line flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-bold text-accent-soft">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-accent-soft" />
                Live Stripe Secret Key
              </span>
              <span className="text-[10px] text-accent-soft">Optional Live Data</span>
            </div>
            <p className="text-[10px] text-ink-soft leading-normal">
              Connect a restricted read-only Stripe key (<code className="bg-surface-solid px-1 py-0.5 rounded border border-accent-line font-mono text-accent-soft">rk_live_...</code>).
            </p>
            <div className="flex gap-1.5 mt-0.5">
              <input
                type="password"
                placeholder="rk_live_..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-surface-solid border border-accent-line rounded-lg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={() => onSaveStripeKey(apiKeyInput)}
                className="px-3.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-ink rounded-lg font-bold cursor-pointer transition-all shadow-xs"
              >
                Save
              </button>
            </div>
          </div>

          {/* Webhook Event Dispatcher */}
          <div className="flex flex-col gap-2">
            <span className="font-bold text-ink-faint text-[10px] uppercase tracking-wider">
              Trigger Simulated Webhooks
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() =>
                  onSimulateWebhook('customer.subscription.created', {
                    plan: selectedPlan,
                    customer_name: customerName,
                    mrr: Number(customMrr),
                  })
                }
                className="flex items-center justify-center gap-1.5 p-2 bg-accent hover:bg-accent-hover text-accent-ink rounded-xl font-bold cursor-pointer transition-all shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Sub
              </button>

              <button
                onClick={() =>
                  onSimulateWebhook('invoice.payment_succeeded', {
                    plan: selectedPlan,
                    customer_name: customerName,
                  })
                }
                className="flex items-center justify-center gap-1.5 p-2 bg-accent-wash hover:bg-accent-wash text-accent-soft border border-accent-line rounded-xl font-bold cursor-pointer transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-soft" />
                Payment Paid
              </button>

              <button
                onClick={() =>
                  onSimulateWebhook('invoice.payment_failed', {
                    plan: selectedPlan,
                    customer_name: customerName,
                  })
                }
                className="flex items-center justify-center gap-1.5 p-2 bg-danger-wash hover:bg-danger-wash text-danger-ink border border-danger-line rounded-xl font-bold cursor-pointer transition-all"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-danger-ink" />
                Charge Failed
              </button>

              <button
                onClick={() =>
                  onSimulateWebhook('customer.subscription.deleted', {
                    plan: selectedPlan,
                    customer_name: customerName,
                  })
                }
                className="flex items-center justify-center gap-1.5 p-2 bg-inset hover:bg-inset-strong text-ink-soft rounded-xl font-bold cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-ink-faint" />
                Churned
              </button>
            </div>
          </div>

          {/* Target Payload Customization */}
          <div className="bg-inset p-3 rounded-xl border border-hairline flex flex-col gap-1.5">
            <span className="font-bold text-ink-faint text-[9px] uppercase tracking-wider">
              Webhook Event Payload Config
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] text-ink-faint font-bold">Tier</label>
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value as PlanTier)}
                  className="px-2 py-1 bg-surface-solid border border-hairline rounded-lg text-xs font-bold focus:outline-none"
                >
                  {planNames().map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-0.5 col-span-2">
                <label className="text-[9px] text-ink-faint font-bold">Account Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="px-2.5 py-1 bg-surface-solid border border-hairline rounded-lg text-xs font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
