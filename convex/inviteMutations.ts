/**
 * Internal mutations for invites — called from httpAction handlers.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Create a new invite row. */
export const create = internalMutation({
  args: {
    code: v.string(),
    inviterSpotifyUserId: v.string(),
    status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("expired")),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("invites", {
      code: args.code,
      inviterSpotifyUserId: args.inviterSpotifyUserId,
      inviteeSpotifyUserId: null,
      status: args.status,
      createdAt: args.createdAt,
      claimedAt: null,
      expiresAt: args.expiresAt,
    });
  },
});

/** Update an invite's status (e.g. mark expired). */
export const updateStatus = internalMutation({
  args: {
    inviteId: v.id("invites"),
    status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("expired")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, { status: args.status });
  },
});

/** Mark an invite as claimed. */
export const markClaimed = internalMutation({
  args: {
    inviteId: v.id("invites"),
    inviteeSpotifyUserId: v.string(),
    claimedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.inviteId, {
      status: "claimed",
      inviteeSpotifyUserId: args.inviteeSpotifyUserId,
      claimedAt: args.claimedAt,
    });
  },
});
