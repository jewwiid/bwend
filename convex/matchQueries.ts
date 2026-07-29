/**
 * Internal queries for matches — called from httpAction handlers.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Get matches where the caller is user A (inviter). */
export const byUserA = internalQuery({
  args: { spotifyUserId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_user_a", (q) => q.eq("userASpotifyUserId", args.spotifyUserId))
      .take(20);
  },
});

/** Get matches where the caller is user B (invitee). */
export const byUserB = internalQuery({
  args: { spotifyUserId: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_user_b", (q) => q.eq("userBSpotifyUserId", args.spotifyUserId))
      .take(20);
  },
});

/** Get a match by its Convex document id. */
export const getById = internalQuery({
  args: { matchId: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.matchId as any);
  },
});
