import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const breakdown = {
  trackOverlap: 0.5,
  artistOverlap: 0.6,
  genreOverlap: null,
  popularitySim: null,
  eraSim: 0.8,
  discoverySim: 0.4,
  clockSim: null,
};

async function insertPendingInvite(
  t: ReturnType<typeof convexTest>,
  code: string,
  inviterSpotifyUserId = "inviter",
  expiresAt = Date.now() + 60_000
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("invites", {
      code,
      inviterSpotifyUserId,
      inviteeSpotifyUserId: null,
      status: "pending",
      createdAt: Date.now(),
      claimedAt: null,
      expiresAt,
    });
  });
}

describe("invite lifecycle", () => {
  test("a claimed invite creates exactly one match", async () => {
    const t = convexTest(schema, modules);
    const inviteId = await insertPendingInvite(t, "ONEWIN");
    const args = {
      inviteId,
      claimerSpotifyUserId: "first-recipient",
      vibeScore: 72,
      breakdown,
      anchorTrack: null,
      sharedTopArtistNames: ["Artist"],
      sharedTopTrackNames: [],
      compatibilityRead: "Your libraries meet around Artist.",
      claimedAt: Date.now(),
    };

    const first = await t.mutation(internal.matchMutations.finalizeClaim, args);
    const second = await t.mutation(internal.matchMutations.finalizeClaim, {
      ...args,
      claimerSpotifyUserId: "second-recipient",
    });
    const matches = await t.run(async (ctx) => await ctx.db.query("matches").take(10));
    const invite = await t.run(async (ctx) => await ctx.db.get(inviteId));

    expect(first.outcome).toBe("claimed");
    expect(second).toEqual({ outcome: "not_claimable" });
    expect(matches).toHaveLength(1);
    expect(invite?.inviteeSpotifyUserId).toBe("first-recipient");
    expect(invite?.status).toBe("claimed");
  });

  test("only the sender can cancel a pending invite", async () => {
    const t = convexTest(schema, modules);
    const inviteId = await insertPendingInvite(t, "PRIVATE");

    const wrongUser = await t.mutation(internal.inviteMutations.cancelPending, {
      code: "PRIVATE",
      inviterSpotifyUserId: "someone-else",
    });
    const stillThere = await t.run(async (ctx) => await ctx.db.get(inviteId));
    const sender = await t.mutation(internal.inviteMutations.cancelPending, {
      code: "PRIVATE",
      inviterSpotifyUserId: "inviter",
    });
    const deleted = await t.run(async (ctx) => await ctx.db.get(inviteId));

    expect(wrongUser).toEqual({ outcome: "not_found" });
    expect(stillThere).not.toBeNull();
    expect(sender).toEqual({ outcome: "cancelled" });
    expect(deleted).toBeNull();
  });

  test("the invite list reports an overdue pending link as expired", async () => {
    const t = convexTest(schema, modules);
    await insertPendingInvite(t, "TOOLATE", "inviter", Date.now() - 1);

    const invites = await t.query(internal.inviteQueries.listByInviter, {
      spotifyUserId: "inviter",
    });

    expect(invites).toHaveLength(1);
    expect(invites[0].status).toBe("expired");
  });
});
