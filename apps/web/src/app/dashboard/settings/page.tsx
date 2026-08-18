"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { updateProfile } from "@/lib/actions/user";
import { uploadFile } from "@/lib/supabase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileSettingsSkeleton } from "@/components/skeletons";
import { Field, FIELD_INPUT, SettingsCard } from "@/components/settings/settings-card";
import { cn } from "@/lib/utils";

export default function ProfileSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialized, setInitialized] = useState(false);

  if (isPending) return <ProfileSettingsSkeleton />;
  if (!session) return null;

  if (!initialized) {
    setName(session.user.name ?? "");
    setBio(((session.user as Record<string, unknown>).bio as string) ?? "");
    setAvatarUrl(session.user.image ?? "");
    setInitialized(true);
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "U";

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${session!.user.id}.${ext}`;
      const result = await uploadFile("avatars", path, file);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setAvatarUrl(result.url);
      await updateProfile({ image: result.url });
      toast.success("Avatar updated");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ name, bio, image: avatarUrl || undefined });
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Profile photo"
        description="Shown beside your name across the app."
      >
        <div className="flex flex-wrap items-center gap-4">
          {/*
            The avatar is still a click target, but it is no longer the *only* one:
            "click the picture" was the entire affordance, and a hover state is not
            an instruction on a touchscreen.
          */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative cursor-pointer rounded-full"
            disabled={uploading}
            aria-label="Upload a new profile picture"
          >
            <Avatar className="size-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-muted text-sm font-bold text-foreground/70">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute inset-0 grid place-items-center rounded-full bg-black/50 transition-opacity",
                uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {uploading && <Loader2 className="size-4 animate-spin text-white" />}
            </span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />

          <div className="min-w-0">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-full px-4 text-[13px]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  Upload photo
                </>
              )}
            </Button>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Square, at least 200×200px. JPG, PNG or WebP, up to 5MB.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Profile"
        description="Your name and bio, visible to others."
        footer={
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-9 rounded-full px-4 text-[13px]"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="name">
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className={FIELD_INPUT}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            hint="Your sign-in address — it cannot be changed here."
          >
            <Input
              id="email"
              value={session.user.email}
              disabled
              className={cn(FIELD_INPUT, "text-muted-foreground")}
            />
          </Field>

          <Field label="Bio" htmlFor="bio">
            <Textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell us about yourself…"
              rows={4}
              className="resize-none rounded-xl border-border bg-muted/60 px-3.5 py-3 text-[13px] md:text-[13px]"
            />
          </Field>
        </div>
      </SettingsCard>
    </div>
  );
}
