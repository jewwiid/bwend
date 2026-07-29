/**
 * Internal queries for invites — called from httpAction handlers.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Get all invite codes (for collision avoidance when creating new codes). */
export const allCodes = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    // Bounded collect — collision detection needs all codes, but we cap at 10k defensively.
    const invites = await ctx.db.query("invites").take(10000);
    return invites.map((i) => i.code);
  },
});

/** Get an invite by its code. */
export const getByCode = internalQuery({
  args: { code: v.string() },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});
