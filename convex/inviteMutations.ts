/**
 * Internal mutations for invites — called from httpAction handlers.
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const selectedTrackValidator = v.object({
  id: v.string(),
  name: v.string(),
  artistName: v.union(v.string(), v.null()),
  imageURL: v.union(v.string(), v.null()),
  spotifyURL: v.union(v.string(), v.null()),
});

/** Create a new invite row. */
export const create = internalMutation({
  args: {
    code: v.string(),
    inviterSpotifyUserId: v.string(),
    status: v.union(v.literal("pending"), v.literal("claimed"), v.literal("expired")),
    selectedTrack: v.optional(selectedTrackValidator),
    spotifyBlendURL: v.optional(v.string()),
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
      ...(args.selectedTrack ? { selectedTrack: args.selectedTrack } : {}),
      ...(args.spotifyBlendURL ? { spotifyBlendURL: args.spotifyBlendURL } : {}),
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

/**
 * Revoke an unused invite. Deleting the row makes the shared URL stop working immediately and
 * avoids retaining a cancelled connection attempt.
 */
export const cancelPending = internalMutation({
  args: {
    code: v.string(),
    inviterSpotifyUserId: v.string(),
  },
  returns: v.union(
    v.object({ outcome: v.literal("cancelled") }),
    v.object({ outcome: v.literal("not_found") }),
    v.object({ outcome: v.literal("already_claimed") })
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    // Treat another user's code as absent so this endpoint does not reveal ownership.
    if (!invite || invite.inviterSpotifyUserId !== args.inviterSpotifyUserId) {
      return { outcome: "not_found" as const };
    }
    if (invite.status === "claimed") {
      return { outcome: "already_claimed" as const };
    }

    await ctx.db.delete(invite._id);
    return { outcome: "cancelled" as const };
  },
});
