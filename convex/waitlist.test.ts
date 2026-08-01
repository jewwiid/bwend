import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { LAUNCH_INTEREST_CONSENT_VERSION } from "./waitlist";

describe("launch interest", () => {
  test("requires explicit consent and supports token-based deletion", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.mutation(api.waitlist.join, {
        email: "person@example.com",
        consent: false,
        consentVersion: LAUNCH_INTEREST_CONSENT_VERSION,
        source: "landing",
      })
    ).rejects.toThrow("Consent is required");

    const joined = await t.mutation(api.waitlist.join, {
      email: " Person@Example.com ",
      consent: true,
      consentVersion: LAUNCH_INTEREST_CONSENT_VERSION,
      source: "in_person_qr",
    });
    const stored = await t.run(async (ctx) => await ctx.db.get(joined.id));
    expect(stored?.email).toBe("person@example.com");
    expect(stored?.consentVersion).toBe(LAUNCH_INTEREST_CONSENT_VERSION);
    expect(stored?.source).toBe("in_person_qr");
    expect(stored?.expiresAt).toBeGreaterThan(Date.now());

    await expect(
      t.mutation(api.waitlist.remove, { manageToken: "wrong-token" })
    ).resolves.toEqual({ removed: false });
    await expect(
      t.mutation(api.waitlist.remove, { manageToken: joined.manageToken })
    ).resolves.toEqual({ removed: true });
    expect(await t.run(async (ctx) => await ctx.db.get(joined.id))).toBeNull();
  });

  test("retention cleanup deletes expired and legacy unconsented records", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("waitlist", {
        email: "expired@example.com",
        consentVersion: LAUNCH_INTEREST_CONSENT_VERSION,
        consentedAt: Date.now() - 10,
        source: "landing",
        manageTokenHash: "hash",
        expiresAt: Date.now() - 1,
        createdAt: Date.now() - 10,
        updatedAt: Date.now() - 10,
      });
      await ctx.db.insert("waitlist", {
        email: "legacy@example.com",
        createdAt: Date.now() - 10,
      });
    });
    await expect(t.mutation(internal.waitlist.cleanupExpired, {})).resolves.toBe(2);
    expect(await t.run(async (ctx) => await ctx.db.query("waitlist").take(10))).toHaveLength(0);
  });
});
