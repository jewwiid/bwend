import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const LAUNCH_INTEREST_CONSENT_VERSION = "2026-08-01.launch-interest.v1";
const INTEREST_RETENTION_MS = 2 * 365 * 24 * 60 * 60 * 1000;

const sourceValidator = v.union(
  v.literal("landing"),
  v.literal("in_person_qr"),
  v.literal("invite_capacity")
);

export const join = mutation({
  args: {
    email: v.string(),
    consent: v.boolean(),
    consentVersion: v.string(),
    source: sourceValidator,
    website: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("waitlist"),
    manageToken: v.string(),
  }),
  handler: async (ctx, args) => {
    // Honeypot for commodity form bots. Keep the response indistinguishable from validation.
    if ((args.website ?? "").trim().length > 0) throw new Error("Could not save this email.");
    if (!args.consent || args.consentVersion !== LAUNCH_INTEREST_CONSENT_VERSION) {
      throw new Error("Consent is required to receive launch updates.");
    }
    const email = args.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    const now = Date.now();
    const manageToken = randomToken();
    const manageTokenHash = await sha256(manageToken);

    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        consentVersion: args.consentVersion,
        consentedAt: now,
        source: args.source,
        manageTokenHash,
        expiresAt: now + INTEREST_RETENTION_MS,
        updatedAt: now,
      });
      return { id: existing._id, manageToken };
    }

    const id = await ctx.db.insert("waitlist", {
      email,
      consentVersion: args.consentVersion,
      consentedAt: now,
      source: args.source,
      manageTokenHash,
      expiresAt: now + INTEREST_RETENTION_MS,
      createdAt: now,
      updatedAt: now,
    });
    return { id, manageToken };
  },
});

/** Delete an interest record using the unguessable token returned at signup. */
export const remove = mutation({
  args: { manageToken: v.string() },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.manageToken.length < 32 || args.manageToken.length > 128) {
      return { removed: false };
    }
    const manageTokenHash = await sha256(args.manageToken);
    const record = await ctx.db
      .query("waitlist")
      .withIndex("by_manage_token_hash", (q) => q.eq("manageTokenHash", manageTokenHash))
      .first();
    if (!record) return { removed: false };
    await ctx.db.delete(record._id);
    return { removed: true };
  },
});

/**
 * Daily storage-limitation cleanup. Rows from the old email form have no recorded consent
 * version and must not be reinterpreted as launch-marketing consent, so they are purged too.
 */
export const cleanupExpired = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const legacyWithoutConsent = await ctx.db
      .query("waitlist")
      .withIndex("by_consent_version", (q) => q.eq("consentVersion", undefined))
      .take(100);
    for (const record of legacyWithoutConsent) await ctx.db.delete(record._id);

    const expired = await ctx.db
      .query("waitlist")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", Date.now()))
      .take(100);
    for (const record of expired) await ctx.db.delete(record._id);
    return legacyWithoutConsent.length + expired.length;
  },
});

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
