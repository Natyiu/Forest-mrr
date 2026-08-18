"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Globe, Mail, Type, ToggleLeft, Users, Timer } from "lucide-react";
import { getAppSettings } from "@/lib/actions/user";
import { updateAppSettings, getWaitlistEntries } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { GeneralSettingsSkeleton } from "@/components/skeletons";

type WaitlistSettings = {
  waitlistMode: boolean;
  waitlistTitle: string;
  waitlistHeadline: string;
  waitlistDescription: string;
  waitlistButtonText: string;
  waitlistSuccessMessage: string;
  waitlistShowName: boolean;
  waitlistShowCompany: boolean;
};

type CountdownSettings = {
  countdownMode: boolean;
  countdownTarget: string; // YYYY-MM-DDTHH:mm for datetime-local
  countdownTitle: string;
  countdownHeadline: string;
  countdownDescription: string;
  countdownEndMessage: string;
};

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card shadow-elev-1 rounded-xl">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 items-start">
      <div className="pt-1.5">
        <Label className="text-sm font-medium">{label}</Label>
        {hint && (
          <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function AdminSiteSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof getWaitlistEntries>>>([]);
  const [s, setS] = useState<WaitlistSettings>({
    waitlistMode: false,
    waitlistTitle: "Join the waitlist",
    waitlistHeadline: "Be the first to know when we launch",
    waitlistDescription: "",
    waitlistButtonText: "Join waitlist",
    waitlistSuccessMessage: "You're on the list! We'll notify you when we launch.",
    waitlistShowName: false,
    waitlistShowCompany: false,
  });
  const [c, setC] = useState<CountdownSettings>({
    countdownMode: false,
    countdownTarget: "",
    countdownTitle: "Coming soon",
    countdownHeadline: "We're launching soon",
    countdownDescription: "",
    countdownEndMessage: "We're live! Check back soon.",
  });

  useEffect(() => {
    Promise.all([getAppSettings(), getWaitlistEntries()]).then(([data, list]) => {
      const d = data as Record<string, unknown>;
      setS({
        waitlistMode: (d.waitlistMode as boolean) ?? false,
        waitlistTitle: (d.waitlistTitle as string) ?? "Join the waitlist",
        waitlistHeadline: (d.waitlistHeadline as string) ?? "Be the first to know when we launch",
        waitlistDescription: (d.waitlistDescription as string) ?? "",
        waitlistButtonText: (d.waitlistButtonText as string) ?? "Join waitlist",
        waitlistSuccessMessage: (d.waitlistSuccessMessage as string) ?? "You're on the list! We'll notify you when we launch.",
        waitlistShowName: (d.waitlistShowName as boolean) ?? false,
        waitlistShowCompany: (d.waitlistShowCompany as boolean) ?? false,
      });
      const target = d.countdownTarget as string | Date | null | undefined;
      setC({
        countdownMode: (d.countdownMode as boolean) ?? false,
        countdownTarget: target
          ? new Date(target).toISOString().slice(0, 16)
          : "",
        countdownTitle: (d.countdownTitle as string) ?? "Coming soon",
        countdownHeadline: (d.countdownHeadline as string) ?? "We're launching soon",
        countdownDescription: (d.countdownDescription as string) ?? "",
        countdownEndMessage: (d.countdownEndMessage as string) ?? "We're live! Check back soon.",
      });
      setEntries(list);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof WaitlistSettings>(key: K, value: WaitlistSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function updateCountdown<K extends keyof CountdownSettings>(key: K, value: CountdownSettings[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateAppSettings({
        ...s,
        countdownMode: c.countdownMode,
        countdownTarget: c.countdownTarget ? new Date(c.countdownTarget) : null,
        countdownTitle: c.countdownTitle,
        countdownHeadline: c.countdownHeadline,
        countdownDescription: c.countdownDescription,
        countdownEndMessage: c.countdownEndMessage,
      });
      toast.success("Site settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle<K extends keyof WaitlistSettings>(key: K, value: WaitlistSettings[K]) {
    const prev = s[key];
    update(key, value);
    try {
      await updateAppSettings({ [key]: value });
      toast.success("Setting updated");
    } catch {
      update(key, prev);
      toast.error("Failed to update");
    }
  }

  async function handleCountdownToggle<K extends keyof CountdownSettings>(key: K, value: CountdownSettings[K]) {
    const prev = c[key];
    updateCountdown(key, value);
    try {
      const payload: Record<string, unknown> = {
        [key]: key === "countdownTarget" && typeof value === "string" && value
          ? new Date(value)
          : value,
      };
      await updateAppSettings(payload as Parameters<typeof updateAppSettings>[0]);
      toast.success("Setting updated");
    } catch {
      updateCountdown(key, prev);
      toast.error("Failed to update");
    }
  }

  if (loading) return <GeneralSettingsSkeleton />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Site Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Waitlist, countdown, and landing page UI configuration
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="text-xs h-9"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <SectionCard
        icon={Timer}
        title="Countdown Mode"
        description="Show a countdown to launch or when the site will be available"
      >
        <ToggleRow
          label="Enable Countdown Mode"
          hint="Replace the main landing page with a countdown timer. Use for launch dates, coming back soon, or user-locked access."
          checked={c.countdownMode}
          onCheckedChange={(v) => handleCountdownToggle("countdownMode", v)}
        />
        {c.countdownMode && (
          <div className="border-t border-border pt-3 space-y-4">
            <FieldRow label="Target Date & Time" hint="When the countdown ends (launch, availability, etc.)">
              <Input
                type="datetime-local"
                value={c.countdownTarget}
                onChange={(e) => updateCountdown("countdownTarget", e.target.value)}
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Title" hint="Main heading">
              <Input
                value={c.countdownTitle}
                onChange={(e) => updateCountdown("countdownTitle", e.target.value)}
                placeholder="Coming soon"
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Headline" hint="Subheading">
              <Input
                value={c.countdownHeadline}
                onChange={(e) => updateCountdown("countdownHeadline", e.target.value)}
                placeholder="We're launching soon"
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Description" hint="Optional longer description">
              <Textarea
                value={c.countdownDescription}
                onChange={(e) => updateCountdown("countdownDescription", e.target.value)}
                placeholder="Tell visitors what to expect..."
                className="min-h-[60px] text-xs resize-none"
              />
            </FieldRow>
            <FieldRow label="End Message" hint="Shown when countdown reaches zero">
              <Input
                value={c.countdownEndMessage}
                onChange={(e) => updateCountdown("countdownEndMessage", e.target.value)}
                placeholder="We're live!"
                className="h-9 text-xs"
              />
            </FieldRow>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={ToggleLeft}
        title="Waitlist Mode"
        description="When enabled, the site becomes a waitlist landing page that collects emails"
      >
        <ToggleRow
          label="Enable Waitlist Mode"
          hint="Replace the main landing page with a waitlist form. Visitors can only submit their email (and optional fields)."
          checked={s.waitlistMode}
          onCheckedChange={(v) => handleToggle("waitlistMode", v)}
        />
      </SectionCard>

      {s.waitlistMode && (
        <>
          <SectionCard
            icon={Type}
            title="Waitlist UI"
            description="Configure the text and labels shown on the waitlist form"
          >
            <FieldRow label="Title" hint="Main heading (e.g. Join the waitlist)">
              <Input
                value={s.waitlistTitle}
                onChange={(e) => update("waitlistTitle", e.target.value)}
                placeholder="Join the waitlist"
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Headline" hint="Subheading below the title">
              <Input
                value={s.waitlistHeadline}
                onChange={(e) => update("waitlistHeadline", e.target.value)}
                placeholder="Be the first to know when we launch"
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Description" hint="Optional longer description">
              <Textarea
                value={s.waitlistDescription}
                onChange={(e) => update("waitlistDescription", e.target.value)}
                placeholder="Tell visitors what they're signing up for..."
                className="min-h-[60px] text-xs resize-none"
              />
            </FieldRow>
            <FieldRow label="Button Text" hint="Submit button label">
              <Input
                value={s.waitlistButtonText}
                onChange={(e) => update("waitlistButtonText", e.target.value)}
                placeholder="Join waitlist"
                className="h-9 text-xs"
              />
            </FieldRow>
            <FieldRow label="Success Message" hint="Shown after a user joins">
              <Input
                value={s.waitlistSuccessMessage}
                onChange={(e) => update("waitlistSuccessMessage", e.target.value)}
                placeholder="You're on the list!"
                className="h-9 text-xs"
              />
            </FieldRow>
          </SectionCard>

          <SectionCard
            icon={Mail}
            title="Form Fields"
            description="Choose which fields to show on the waitlist form"
          >
            <ToggleRow
              label="Show Name Field"
              hint="Collect visitor names in addition to email"
              checked={s.waitlistShowName}
              onCheckedChange={(v) => handleToggle("waitlistShowName", v)}
            />
            <div className="border-t border-border pt-3">
              <ToggleRow
                label="Show Company Field"
                hint="Collect company/organization name"
                checked={s.waitlistShowCompany}
                onCheckedChange={(v) => handleToggle("waitlistShowCompany", v)}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Users}
            title="Waitlist Entries"
            description={`${entries.length} signups`}
          >
            <div className="max-h-64 overflow-y-auto border border-border rounded">
              {entries.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground text-center">No entries yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      {s.waitlistShowName && <th className="text-left px-3 py-2 font-medium">Name</th>}
                      {s.waitlistShowCompany && <th className="text-left px-3 py-2 font-medium">Company</th>}
                      <th className="text-left px-3 py-2 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{e.email}</td>
                        {s.waitlistShowName && <td className="px-3 py-2">{e.name ?? "—"}</td>}
                        {s.waitlistShowCompany && <td className="px-3 py-2">{e.company ?? "—"}</td>}
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(e.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </>
      )}

      <div className="flex justify-end pb-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="text-xs h-9"
        >
          {saving ? "Saving..." : "Save All Changes"}
        </Button>
      </div>
    </div>
  );
}
