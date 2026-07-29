/**
 * Internal query alias for bwendProfile lookups — re-exports getBySpotifyUserId
 * so handlers can call internal.bwendProfileQueries.getBySpotifyUserId.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getBySpotifyUserId = internalQuery({
  args: { spotifyUserId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();
  },
});

/** Batch fetch profiles by a list of Spotify user ids (for resolving partner names). */
export const batchBySpotifyUserIds = internalQuery({
  args: { spotifyUserIds: v.array(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.spotifyUserIds) {
      const profile = await ctx.db
        .query("bwendProfiles")
        .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", id))
        .first();
      if (profile) results.push(profile);
    }
    return results;
  },
});
