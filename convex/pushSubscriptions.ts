/**
 * APNs device-token persistence and Daily Blend delivery state.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const environmentValidator = v.union(v.literal("sandbox"), v.literal("production"));

const subscriptionValidator = v.object({
  _id: v.id("pushSubscriptions"),
  _creationTime: v.number(),
  spotifyUserId: v.string(),
  deviceToken: v.string(),
  environment: environmentValidator,
  timezone: v.string(),
  dailyHour: v.number(),
  enabled: v.boolean(),
  lastDailySentKey: v.optional(v.string()),
  updatedAt: v.number(),
});

export const register = internalMutation({
  args: {
    spotifyUserId: v.string(),
    deviceToken: v.string(),
    environment: environmentValidator,
    timezone: v.string(),
    dailyHour: v.number(),
  },
  returns: v.id("pushSubscriptions"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_device_token", (q) => q.eq("deviceToken", args.deviceToken))
      .first();
    const values = {
      spotifyUserId: args.spotifyUserId,
      environment: args.environment,
      timezone: args.timezone,
      dailyHour: Math.max(0, Math.min(23, Math.round(args.dailyHour))),
      enabled: true,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("pushSubscriptions", {
      ...values,
      deviceToken: args.deviceToken,
    });
  },
});

export const disable = internalMutation({
  args: {
    spotifyUserId: v.string(),
    deviceToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_device_token", (q) => q.eq("deviceToken", args.deviceToken))
      .first();
    if (existing?.spotifyUserId === args.spotifyUserId) {
      await ctx.db.patch(existing._id, { enabled: false, updatedAt: Date.now() });
    }
    return null;
  },
});

export const disableById = internalMutation({
  args: { subscriptionId: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, { enabled: false, updatedAt: Date.now() });
    return null;
  },
});

export const markDailySent = internalMutation({
  args: {
    subscriptionId: v.id("pushSubscriptions"),
    dateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      lastDailySentKey: args.dateKey,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const listEnabled = internalQuery({
  args: {},
  returns: v.array(subscriptionValidator),
  handler: async (ctx) => {
    // Bounded MVP batch. When registrations approach this limit, move fan-out to Workpool.
    return await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .take(500);
  },
});
