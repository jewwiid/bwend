/**
 * Queue and cache management for the artist enrichment table.
 *
 * Kept in the default runtime (no "use node") so the enrichment action can call these without
 * dragging the Node bundle into the mutation path.
 */

import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/** Re-enrich rows this old. Artists gain tags and neighbours in MusicBrainz over time. */
const REFRESH_HORIZON_MS = 30 * 24 * 60 * 60 * 1000;

/** Give up after this many failed attempts and let the long horizon retry it later. */
const MAX_ATTEMPTS = 3;

/**
 * Register artists for enrichment. Existing rows are left alone unless they're stale, so a
 * user reconnecting doesn't re-queue the whole catalogue.
 *
 * Returns how many rows are newly pending, so the caller knows whether to wake the worker.
 */
export const enqueue = internalMutation({
  args: {
    artists: v.array(v.object({ spotifyId: v.string(), name: v.string() })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    let queued = 0;

    for (const artist of args.artists) {
      const existing = await ctx.db
        .query("artists")
        .withIndex("by_spotify_id", (q) => q.eq("spotifyId", artist.spotifyId))
        .first();

      if (!existing) {
        await ctx.db.insert("artists", {
          spotifyId: artist.spotifyId,
          name: artist.name,
          mbid: null,
          genres: [],
          country: null,
          similar: [],
          status: "pending",
          attempts: 0,
          updatedAt: now,
        });
        queued++;
        continue;
      }

      // Already pending — leave the attempt count alone so a failing artist can't be reset
      // into an infinite retry loop by users reconnecting.
      if (existing.status === "pending") {
        queued++;
        continue;
      }

      if (now - existing.updatedAt > REFRESH_HORIZON_MS) {
        await ctx.db.patch(existing._id, { status: "pending", attempts: 0, updatedAt: now });
        queued++;
      }
    }

    return queued;
  },
});

/** Oldest pending artists first, so the queue drains fairly rather than starving early rows. */
export const nextPending = internalQuery({
  args: { limit: v.number() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artists")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit);
  },
});

/** Store a successful enrichment. */
export const saveEnrichment = internalMutation({
  args: {
    spotifyId: v.string(),
    mbid: v.union(v.string(), v.null()),
    genres: v.array(v.string()),
    country: v.union(v.string(), v.null()),
    similar: v.array(v.object({ mbid: v.string(), name: v.string(), score: v.number() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artists")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();
    if (!existing) return null;

    await ctx.db.patch(existing._id, {
      mbid: args.mbid,
      genres: args.genres,
      country: args.country,
      similar: args.similar,
      // An artist that resolved to no MBID at all is unresolved, not enriched — the
      // distinction matters when measuring coverage.
      status: args.mbid ? "enriched" : "unresolved",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Record a failed attempt. Stays pending for another pass until MAX_ATTEMPTS, because most
 * failures here are transient throttling rather than missing data.
 */
export const recordFailure = internalMutation({
  args: { spotifyId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artists")
      .withIndex("by_spotify_id", (q) => q.eq("spotifyId", args.spotifyId))
      .first();
    if (!existing) return null;

    const attempts = existing.attempts + 1;
    await ctx.db.patch(existing._id, {
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "unresolved" : "pending",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/** Enrichment rows for a set of Spotify artist ids — the read path for scoring. */
export const bySpotifyIds = internalQuery({
  args: { spotifyIds: v.array(v.string()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    const rows = [];
    for (const spotifyId of args.spotifyIds) {
      const row = await ctx.db
        .query("artists")
        .withIndex("by_spotify_id", (q) => q.eq("spotifyId", spotifyId))
        .first();
      if (row) rows.push(row);
    }
    return rows;
  },
});

/** Queue health, for the coverage log line. */
export const enrichmentStats = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const counts = { pending: 0, enriched: 0, unresolved: 0 };
    for (const status of ["pending", "enriched", "unresolved"] as const) {
      const rows = await ctx.db
        .query("artists")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(1000);
      counts[status] = rows.length;
    }
    return counts;
  },
});
