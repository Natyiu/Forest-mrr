"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ExternalLink, Loader2, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderMark } from "@/components/revenue/provider-mark";
import {
  type CredentialField,
  type Credentials,
  type HelpCard,
  type RevenueProviderId,
  REVENUE_PROVIDERS,
  REVENUE_PROVIDER_LIST,
  apiKeyLooksValid,
  credentialSteps,
  hasRemoteStep,
  validateCredentials,
} from "@/lib/revenue/providers";
import {
  type RevenueConnectionView,
  listRevenueProviderOptions,
  removeRevenueConnection,
  saveRevenueConnection,
} from "@/lib/actions/revenue";
import { cn } from "@/lib/utils";

/**
 * **One dialog for six providers.**
 *
 * Every provider asks for something different, so nothing about the questions
 * is written here: the dialog walks `provider.steps` and renders each one —
 * secret, text, URL, a select whose options only the provider can supply, or a
 * numbered note that asks for nothing. The copy under each field is the
 * provider's own instructions, held in the registry next to the pattern that
 * validates the answer, because the two go out of step the moment they live
 * apart.
 *
 * The same `validateCredentials` runs here and in the action. This side exists
 * to save a round trip on a mistyped key, not to be the check — the server
 * never trusts it.
 */

const REMOTE_DEBOUNCE_MS = 500;

type RemoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; options: Array<{ id: string; label: string; group?: string }> }
  | { kind: "error"; message: string };

export interface ConnectRevenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing connections, so re-connecting says so rather than surprising. */
  connections?: RevenueConnectionView[];
  onConnected?: (connection: RevenueConnectionView) => void;
  /** So the page that owns the list can drop the row this dialog just deleted. */
  onDisconnected?: (provider: RevenueProviderId) => void;
  /** Which provider to land on. Defaults to the first in the registry. */
  initialProvider?: RevenueProviderId;
  /**
   * Which startup the key belongs to.
   *
   * Passed explicitly by the page that manages startups, so pressing *Connect* on
   * a named card is unambiguous about where the key lands. Omitted from the garden,
   * where the answer is "the business I am looking at" and the server resolves it.
   */
  startupId?: string;
}

export function ConnectRevenueDialog({
  open,
  onOpenChange,
  connections = [],
  onConnected,
  onDisconnected,
  initialProvider,
  startupId,
}: ConnectRevenueDialogProps) {
  const [providerId, setProviderId] = useState<RevenueProviderId>(
    initialProvider ?? REVENUE_PROVIDER_LIST[0].id,
  );
  const [values, setValues] = useState<Credentials>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CredentialField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  /**
   * Disconnecting from inside the connect dialog.
   *
   * This is where a person finds out they are already connected, so it is where
   * they need to be able to do something about it — sending them to a settings
   * page to undo what this dialog just told them is a detour. It is a two-step
   * inline confirm rather than an alert dialog on purpose: a modal on top of a
   * modal fights over the focus trap, and the destructive thing here is small and
   * reversible (the key is deleted locally; it stays valid at the provider until
   * revoked there, which the confirm says).
   */
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [disconnected, setDisconnected] = useState<RevenueProviderId[]>([]);
  const [isDisconnecting, startDisconnect] = useTransition();

  const provider = REVENUE_PROVIDERS[providerId];
  const steps = provider.steps;
  const existing = disconnected.includes(providerId)
    ? undefined
    : connections.find((connection) => connection.provider === providerId);

  const reset = useCallback((next: RevenueProviderId) => {
    setProviderId(next);
    setValues({});
    setFieldErrors({});
    setFormError(null);
    setRemote({ kind: "idle" });
    setConfirmingDisconnect(false);
  }, []);

  function disconnect() {
    const target = providerId;
    startDisconnect(async () => {
      const result = await removeRevenueConnection({ provider: target, startupId });
      if (!result.ok) {
        toast.error(result.message ?? `Could not disconnect ${provider.name}`);
        return;
      }

      setConfirmingDisconnect(false);
      setDisconnected((current) => [...current, target]);
      onDisconnected?.(target);
      toast.success(`${provider.name} disconnected`, {
        description: "The stored key is gone from here. Revoke it at the provider too if it leaked.",
      });
    });
  }

  // Opening the dialog is a fresh start: a key left in a field from a cancelled
  // attempt is the one thing here nobody wants to find lying around.
  useEffect(() => {
    if (!open) return;
    reset(initialProvider ?? REVENUE_PROVIDER_LIST[0].id);
    // The parent's list is authoritative again on a fresh open; it has already
    // been told about anything disconnected in the previous one.
    setDisconnected([]);
  }, [open, initialProvider, reset]);

  const apiKey = values.apiKey ?? "";
  const needsRemote = hasRemoteStep(providerId);
  const keyUsable = needsRemote && apiKeyLooksValid(providerId, apiKey);

  // Superwall cannot name its applications until it has been given the key, so
  // the list is fetched as soon as the key looks like one — debounced, because
  // this fires per keystroke otherwise.
  const requestId = useRef(0);
  useEffect(() => {
    if (!needsRemote) return;
    if (!keyUsable) {
      setRemote({ kind: "idle" });
      return;
    }

    const ticket = ++requestId.current;
    setRemote({ kind: "loading" });

    const timer = setTimeout(() => {
      void listRevenueProviderOptions({ provider: providerId, apiKey }).then((result) => {
        // A slower earlier request must not overwrite a newer answer.
        if (ticket !== requestId.current) return;
        setRemote(
          result.ok
            ? { kind: "ready", options: result.options }
            : { kind: "error", message: result.message },
        );
      });
    }, REMOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [apiKey, keyUsable, needsRemote, providerId]);

  const set = (field: CredentialField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const problems = useMemo(() => validateCredentials(providerId, values), [providerId, values]);
  const complete = problems.length === 0;

  function submit() {
    if (!complete) {
      const mapped: Partial<Record<CredentialField, string>> = {};
      for (const problem of problems) mapped[problem.field] ??= problem.message;
      setFieldErrors(mapped);
      setFormError(problems.length === 1 ? problems[0].message : "Some of those values need another look.");
      return;
    }

    startTransition(async () => {
      const result = await saveRevenueConnection({ provider: providerId, credentials: values, startupId });

      if (!result.ok) {
        const mapped: Partial<Record<CredentialField, string>> = {};
        for (const problem of result.problems ?? []) mapped[problem.field] ??= problem.message;
        setFieldErrors(mapped);
        setFormError(result.message);
        return;
      }

      toast.success(
        `${provider.name} connected${result.connection.accountLabel ? ` — ${result.connection.accountLabel}` : ""}`,
        { description: result.detail },
      );
      onConnected?.(result.connection);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">Connect your revenue</DialogTitle>
          <DialogDescription className="text-[11px]">
            Import a read-only API key so we can read your live revenue. Keys are stored
            encrypted, and nothing here can move money.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Choose your payment provider
            </label>
            <Select value={providerId} onValueChange={(next) => reset(next as RevenueProviderId)}>
              <SelectTrigger className="h-10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_PROVIDER_LIST.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      <ProviderMark provider={candidate} size="sm" />
                      {candidate.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {provider.note && (
              <p className="flex items-start gap-1.5 pt-0.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-px size-3 shrink-0" />
                {provider.note}
              </p>
            )}

            {existing && (
              <div className="rounded-xl bg-warn-soft p-2.5">
                <p className="text-[11px] text-warn">
                  Already connected
                  {existing.accountLabel ? ` as ${existing.accountLabel}` : ""} (key ending{" "}
                  {existing.secretHint}). Connecting again replaces that key.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {confirmingDisconnect ? (
                    <>
                      <span className="text-[11px] text-warn">
                        Delete the stored key? It stays valid at {provider.name} until you
                        revoke it there.
                      </span>
                      <Button
                        variant="destructive"
                        size="xs"
                        className="text-[11px]"
                        onClick={disconnect}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Unplug className="size-3" />
                        )}
                        Yes, disconnect
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-[11px]"
                        onClick={() => setConfirmingDisconnect(false)}
                        disabled={isDisconnecting}
                      >
                        Keep it
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[11px]"
                      onClick={() => setConfirmingDisconnect(true)}
                    >
                      <Unplug className="size-3" />
                      Disconnect {provider.name}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {disconnected.includes(providerId) && (
              <p className="text-[11px] text-muted-foreground">
                {provider.name} is disconnected. Paste a key below to connect it again.
              </p>
            )}
          </div>

          {steps.map((step, index) => {
            const number = index + 1;

            if (step.kind === "note") {
              return (
                <StepHeading key={`note-${number}`} number={number} label={step.label} muted>
                  {step.help && <Help card={step.help} />}
                </StepHeading>
              );
            }

            const error = fieldErrors[step.name];

            return (
              <StepHeading key={step.name} number={number} label={step.label}>
                {step.kind === "remote-select" ? (
                  <RemoteSelect
                    state={remote}
                    value={values[step.name] ?? ""}
                    onChange={(next) => set(step.name, next)}
                    placeholder={step.placeholder}
                    emptyPlaceholder={step.emptyPlaceholder}
                  />
                ) : (
                  <Input
                    // A key is a password until it is saved: no autofill, no
                    // spellcheck underlining a base64 payload, no capitalisation.
                    type={step.kind === "secret" ? "password" : "text"}
                    inputMode={step.kind === "url" ? "url" : "text"}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={values[step.name] ?? ""}
                    onChange={(event) => set(step.name, event.target.value)}
                    placeholder={step.placeholder}
                    aria-invalid={Boolean(error)}
                    className="h-10 font-mono text-xs"
                  />
                )}

                {error && <p className="text-[11px] text-destructive">{error}</p>}
                {step.help && <Help card={step.help} />}
              </StepHeading>
            );
          })}

          {formError && (
            <p className="flex items-start gap-1.5 rounded-xl bg-destructive/10 p-2.5 text-[11px] text-destructive">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending} size="sm" className="h-8 text-xs">
            {isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Checking with {provider.name}…
              </>
            ) : (
              `Connect ${provider.name}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "1. Stripe API key", and whatever the step needs under it. */
function StepHeading({
  number,
  label,
  muted,
  children,
}: {
  number: number;
  label: string;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className={cn("text-xs font-semibold", muted ? "text-muted-foreground" : "text-foreground")}>
        {number}. {label}
      </p>
      {children}
    </div>
  );
}

/**
 * The instruction card.
 *
 * Its heading is the link, and the link goes to the page where the key is made —
 * a numbered list whose first step is "find the right page" has skipped the only
 * step people get stuck on.
 */
function Help({ card }: { card: HelpCard }) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <a
          href={card.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] font-semibold text-foreground underline-offset-4 hover:underline"
        >
          {card.title}
        </a>
        <a
          href={card.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={card.title}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      <ol className="mt-1.5 space-y-0.5">
        {card.steps.map((line, index) => (
          <li key={line} className="text-[11px] leading-relaxed text-muted-foreground">
            {index + 1}. {line}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A select whose options had to be fetched with the key above it. */
function RemoteSelect({
  state,
  value,
  onChange,
  placeholder,
  emptyPlaceholder,
}: {
  state: RemoteState;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyPlaceholder: string;
}) {
  if (state.kind === "loading") {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Loading applications…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex h-10 items-center gap-2 rounded-lg border border-destructive/40 px-3 text-[11px] text-destructive">
        <AlertCircle className="size-3.5 shrink-0" />
        <span className="truncate" title={state.message}>
          {state.message}
        </span>
      </div>
    );
  }

  const options = state.kind === "ready" ? state.options : [];
  const groups = [...new Set(options.map((option) => option.group ?? ""))];

  return (
    <Select value={value} onValueChange={onChange} disabled={!options.length}>
      <SelectTrigger className="h-10 text-xs">
        <SelectValue placeholder={options.length ? placeholder : emptyPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => {
          const inGroup = options.filter((option) => (option.group ?? "") === group);
          if (!group) {
            return inGroup.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ));
          }
          return (
            <SelectGroup key={group}>
              <SelectLabel className="text-[10px] uppercase tracking-wider">{group}</SelectLabel>
              {inGroup.map((option) => (
                <SelectItem key={option.id} value={option.id} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
