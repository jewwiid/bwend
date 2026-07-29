/**
 * Background worker that fills the artist enrichment cache.
 *
 * Self-rescheduling: each run takes a small batch, paces itself against MusicBrainz's
 * one-request-per-second limit, then queues the next run if work remains. Nothing user-facing
 * waits on this — profiles are usable immediately and scores improve as the cache fills.
 */

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  lookupArtist,
  similarArtists,
  sleep,
  MB_MIN_INTERVAL_MS,
} from "./lib/musicGraph";

/**
 * Artists per run. Small on purpose: at ~1.2s each this keeps a run near 5 seconds, well
 * inside action limits, and leaves the queue observable rather than opaque.
 */
const BATCH_SIZE = 4;

/** Gap between runs. The real pacing is the in-run sleep; this just avoids a tight loop. */
const RESCHEDULE_MS = 500;

export const processQueue = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const pending: any[] = await ctx.runQuery(internal.artistMutations.nextPending, {
      limit: BATCH_SIZE,
    });

    if (pending.length === 0) {
      const stats = await ctx.runQuery(internal.artistMutations.enrichmentStats, {});
      console.log(
        `artist enrichment · queue drained · enriched=${stats.enriched} unresolved=${stats.unresolved}`
      );
      return { done: true, processed: 0 };
    }

    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const artist = pending[i];

      // Pace against MusicBrainz between artists, not before the first — a run that always
      // slept up front would waste a second on every reschedule.
      if (i > 0) await sleep(MB_MIN_INTERVAL_MS);

      try {
        const found = await lookupArtist(artist.name);

        if (!found) {
          // Genuinely not in MusicBrainz under this name. Record it as a resolved-to-nothing
          // result rather than a failure, so it isn't retried three times for no reason.
          await ctx.runMutation(internal.artistMutations.saveEnrichment, {
            spotifyId: artist.spotifyId,
            mbid: null,
            genres: [],
            country: null,
            similar: [],
          });
          continue;
        }

        // Neighbours are a bonus, not a requirement: ListenBrainz coverage is Western-skewed
        // and plenty of artists have none. Losing them must not discard the genres we just got.
        let similar: Awaited<ReturnType<typeof similarArtists>> = [];
        try {
          similar = await similarArtists(found.mbid);
        } catch {
          similar = [];
        }

        await ctx.runMutation(internal.artistMutations.saveEnrichment, {
          spotifyId: artist.spotifyId,
          mbid: found.mbid,
          genres: found.genres,
          country: found.country,
          similar,
        });
        enriched++;
      } catch {
        // Throttling and transient network errors land here. The row stays pending and is
        // retried on a later run; treating these as "artist doesn't exist" is exactly the
        // mistake that made MusicBrainz look like it was missing well-known artists.
        await ctx.runMutation(internal.artistMutations.recordFailure, {
          spotifyId: artist.spotifyId,
        });
        failed++;
      }
    }

    console.log(
      `artist enrichment · batch of ${pending.length} · enriched=${enriched} failed=${failed}`
    );

    // More to do — queue the next run.
    await ctx.scheduler.runAfter(RESCHEDULE_MS, internal.artistEnrichmentActions.processQueue, {});
    return { done: false, processed: pending.length };
  },
});
