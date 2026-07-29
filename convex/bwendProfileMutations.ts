/**
 * Internal mutations for bwendProfiles — called from actions (spotifyConnect, claimInvite)
 * that need to read/write profile data. Not exposed via HTTP directly.
 */

import { internalMutation, query } from "./_generated/server";
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
      createdAt: now,
      updatedAt: now,
    });
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

/**
 * Internal query — fetch a profile by spotifyUserId.
 */
export const getBySpotifyUserId = query({
  args: { spotifyUserId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();
  },
});
