/**
 * Internal mutations for bwendProfiles — called from actions (spotifyConnect, claimInvite)
 * that need to read/write profile data. Not exposed via HTTP directly.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upsert a profile by spotifyUserId. If it exists, update all fields; if not, insert.
 */
export const upsert = internalMutation({
  args: {
    spotifyUserId: v.string(),
    displayName: v.union(v.string(), v.null()),
    topTracks: v.any(),
    topArtists: v.any(),
    tasteProfile: v.any(),
    spotifyTokenBlob: v.string(),
    privacyConsentVersion: v.string(),
    privacyConsentedAt: v.number(),
    termsVersion: v.string(),
    termsAcceptedAt: v.number(),
  },
  returns: v.id("bwendProfiles"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        topTracks: args.topTracks,
        topArtists: args.topArtists,
        tasteProfile: args.tasteProfile,
        spotifyTokenBlob: args.spotifyTokenBlob,
        identityVersion: 1,
        privacyConsentVersion: args.privacyConsentVersion,
        privacyConsentedAt: args.privacyConsentedAt,
        termsVersion: args.termsVersion,
        termsAcceptedAt: args.termsAcceptedAt,
        disconnectedAt: null,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("bwendProfiles", {
      spotifyUserId: args.spotifyUserId,
      displayName: args.displayName,
      topTracks: args.topTracks,
      topArtists: args.topArtists,
      tasteProfile: args.tasteProfile,
      spotifyTokenBlob: args.spotifyTokenBlob,
      identityVersion: 1,
      privacyConsentVersion: args.privacyConsentVersion,
      privacyConsentedAt: args.privacyConsentedAt,
      termsVersion: args.termsVersion,
      termsAcceptedAt: args.termsAcceptedAt,
      disconnectedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Re-key a legacy raw Spotify identity to its Bwend-only HMAC identifier.
 *
 * Every read uses an index and is bounded. At current product scale the cap is generous; if a
 * user ever has more than 500 records in one category, deletion/export is deliberately stopped
 * for manual handling instead of silently leaving a partial migration.
 */
export const migrateIdentity = internalMutation({
  args: {
    legacySpotifyUserId: v.string(),
    bwendUserId: v.string(),
    alias: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.legacySpotifyUserId === args.bwendUserId) return null;

    const legacyProfile = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) =>
        q.eq("spotifyUserId", args.legacySpotifyUserId)
      )
      .first();
    const currentProfile = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.bwendUserId))
      .first();

    const [invitesAsInviter, invitesAsInvitee, matchesAsA, matchesAsB, playlists, pushes] =
      await Promise.all([
        ctx.db
          .query("invites")
          .withIndex("by_inviter", (q) =>
            q.eq("inviterSpotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
        ctx.db
          .query("invites")
          .withIndex("by_invitee", (q) =>
            q.eq("inviteeSpotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
        ctx.db
          .query("matches")
          .withIndex("by_user_a", (q) =>
            q.eq("userASpotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
        ctx.db
          .query("matches")
          .withIndex("by_user_b", (q) =>
            q.eq("userBSpotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
        ctx.db
          .query("matchPlaylists")
          .withIndex("by_spotify_user_id", (q) =>
            q.eq("spotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
        ctx.db
          .query("pushSubscriptions")
          .withIndex("by_spotify_user_id", (q) =>
            q.eq("spotifyUserId", args.legacySpotifyUserId)
          )
          .take(501),
      ]);

    const groups = [
      invitesAsInviter,
      invitesAsInvitee,
      matchesAsA,
      matchesAsB,
      playlists,
      pushes,
    ];
    if (groups.some((group) => group.length > 500)) {
      throw new Error("Identity migration exceeds the automatic 500-record safety bound.");
    }

    for (const invite of invitesAsInviter) {
      await ctx.db.patch(invite._id, { inviterSpotifyUserId: args.bwendUserId });
    }
    for (const invite of invitesAsInvitee) {
      await ctx.db.patch(invite._id, { inviteeSpotifyUserId: args.bwendUserId });
    }
    for (const match of matchesAsA) {
      await ctx.db.patch(match._id, { userASpotifyUserId: args.bwendUserId });
    }
    for (const match of matchesAsB) {
      await ctx.db.patch(match._id, { userBSpotifyUserId: args.bwendUserId });
    }
    for (const playlist of playlists) {
      await ctx.db.patch(playlist._id, { spotifyUserId: args.bwendUserId });
    }
    for (const push of pushes) {
      await ctx.db.patch(push._id, { spotifyUserId: args.bwendUserId });
    }

    if (legacyProfile && !currentProfile) {
      await ctx.db.patch(legacyProfile._id, {
        spotifyUserId: args.bwendUserId,
        displayName: args.alias,
        identityVersion: 1,
        updatedAt: Date.now(),
      });
    } else if (legacyProfile && currentProfile) {
      await ctx.db.delete(legacyProfile._id);
    }
    return null;
  },
});

/**
 * Persist a refreshed Spotify token blob.
 *
 * Kept separate from `upsert` so the read path can rotate an expired access token without
 * having to resupply the whole profile.
 */
export const updateTokenBlob = internalMutation({
  args: {
    spotifyUserId: v.string(),
    spotifyTokenBlob: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();
    if (!existing) return null;

    await ctx.db.patch(existing._id, {
      spotifyTokenBlob: args.spotifyTokenBlob,
      updatedAt: Date.now(),
    });
    return null;
  },
});
