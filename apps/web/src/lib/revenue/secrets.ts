import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { env } from "@Batman/env/server";

/**
 * **Sealing a provider key at rest.**
 *
 * The rest of this app keeps its own secrets in plain columns (`AppSettings`
 * holds the Polar token and the Resend key that way), and for keys the operator
 * pasted into their own admin panel that is a defensible trade. These are
 * different: they belong to *users*, there is one per user per provider, and a
 * read-only Stripe key still reads every customer name and every charge that
 * business has ever taken. A database export should not be a list of them.
 *
 * AES-256-GCM, so the ciphertext is authenticated: a row edited in the database
 * fails to open rather than decrypting to something else. The envelope carries
 * its own version, because the day the key derivation changes, the rows written
 * before it still have to open.
 *
 * **The key comes from `BETTER_AUTH_SECRET` unless told otherwise.** That is
 * already required, already ≥32 characters and already the thing whose leak ends
 * the session layer, so binding these to it adds no new deployment step and no
 * new secret to lose. `REVENUE_ENCRYPTION_KEY` overrides it for anyone who wants
 * these on their own rotation schedule — rotating the auth secret without it
 * would sign every user out *and* strand every connection.
 */

const VERSION = "v1";
const SALT = "revenue-connection/v1";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const material = env.REVENUE_ENCRYPTION_KEY?.trim() || env.BETTER_AUTH_SECRET;
  if (!material || material.length < 32) {
    throw new Error(
      "Cannot seal provider credentials: set REVENUE_ENCRYPTION_KEY (32+ characters) or a long BETTER_AUTH_SECRET.",
    );
  }

  cachedKey = scryptSync(material, SALT, 32);
  return cachedKey;
}

/** `v1.<iv>.<tag>.<ciphertext>`, all base64url. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Stored credential is not a sealed envelope this build can open.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Seal a whole credential object — the key plus whatever else it needs. */
export function sealCredentials(credentials: Record<string, string | undefined>): string {
  return sealSecret(JSON.stringify(credentials));
}

export function openCredentials(sealed: string): Record<string, string> {
  const parsed: unknown = JSON.parse(openSecret(sealed));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Stored credential did not open to an object.");
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * Constant-time comparison, for the one place a caller asks "is this the same
 * key I already have?" — re-pasting an unchanged key must not read as a change
 * and must not leak position through timing.
 */
export function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
