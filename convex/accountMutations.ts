import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { DISCONNECTED_RETENTION_MS } from "./lib/privacyConstants";

const MAX_USER_RECORDS = 500;

async function bounded<T>(promise: Promise<T[]>): Promise<T[]> {
  const rows = await promise;
  if (rows.length > MAX_USER_RECORDS) {
    throw new Error("Account exceeds the automatic 500-record privacy-operation bound.");
  }
  return rows;
}

async function eraseUserData(ctx: MutationCtx, spotifyUserId: string) {
  const profile = await ctx.db
    .query("bwendProfiles")
    .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", spotifyUserId))
    .first();

  const [invitesAsInviter, invitesAsInvitee, matchesAsA, matchesAsB, userPlaylists, pushes, portrait] =
    await Promise.all([
      bounded(
        ctx.db
          .query("invites")
          .withIndex("by_inviter", (q) => q.eq("inviterSpotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      bounded(
        ctx.db
          .query("invites")
          .withIndex("by_invitee", (q) => q.eq("inviteeSpotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      bounded(
        ctx.db
          .query("matches")
          .withIndex("by_user_a", (q) => q.eq("userASpotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      bounded(
        ctx.db
          .query("matches")
          .withIndex("by_user_b", (q) => q.eq("userBSpotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      bounded(
        ctx.db
          .query("matchPlaylists")
          .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      bounded(
        ctx.db
          .query("pushSubscriptions")
          .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", spotifyUserId))
          .take(MAX_USER_RECORDS + 1)
      ),
      ctx.db
        .query("listeningPortraits")
        .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", spotifyUserId))
        .first(),
    ]);

  const matches = [...matchesAsA, ...matchesAsB];
  const matchPlaylists = await Promise.all(
    matches.map((match) =>
      bounded(
        ctx.db
          .query("matchPlaylists")
          .withIndex("by_match", (q) => q.eq("matchId", match._id))
          .take(MAX_USER_RECORDS + 1)
      )
    )
  );

  const ids = <T extends { _id: unknown }>(rows: T[]) => new Map(rows.map((row) => [row._id, row]));
  for (const row of ids([...invitesAsInviter, ...invitesAsInvitee]).values()) {
    await ctx.db.delete(row._id);
  }
  for (const row of ids([...userPlaylists, ...matchPlaylists.flat()]).values()) {
    await ctx.db.delete(row._id);
  }
  for (const row of ids(matches).values()) {
    await ctx.db.delete(row._id);
  }
  for (const row of pushes) await ctx.db.delete(row._id);
  if (portrait) await ctx.db.delete(portrait._id);
  if (profile) await ctx.db.delete(profile._id);

  return {
    invites: ids([...invitesAsInviter, ...invitesAsInvitee]).size,
    matches: ids(matches).size,
    playlists: ids([...userPlaylists, ...matchPlaylists.flat()]).size,
    pushSubscriptions: pushes.length,
    listeningPortraits: portrait ? 1 : 0,
  };
}

export const disconnectSpotify = internalMutation({
  args: { spotifyUserId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();
    if (!profile) return false;

    const pushes = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .take(MAX_USER_RECORDS);
    for (const push of pushes) {
      await ctx.db.patch(push._id, { enabled: false, updatedAt: Date.now() });
    }
    await ctx.db.patch(profile._id, {
      spotifyTokenBlob: null,
      disconnectedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const eraseAccount = internalMutation({
  args: { spotifyUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => eraseUserData(ctx, args.spotifyUserId),
});

/** Deletes expired, unclaimed share links rather than retaining them indefinitely. */
export const cleanupExpiredInvites = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("invites")
      .withIndex("by_status_and_expires_at", (q) =>
        q.eq("status", "pending").lt("expiresAt", Date.now())
      )
      .take(100);
    for (const invite of expired) await ctx.db.delete(invite._id);
    return expired.length;
  },
});

/** Erases disconnected accounts after the documented 30-day recovery window. */
export const cleanupDisconnectedAccounts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - DISCONNECTED_RETENTION_MS;
    const expired = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_disconnected_at", (q) =>
        q.gte("disconnectedAt", 1).lt("disconnectedAt", cutoff)
      )
      .take(10);
    for (const profile of expired) {
      await eraseUserData(ctx, profile.spotifyUserId);
    }
    return expired.length;
  },
});
