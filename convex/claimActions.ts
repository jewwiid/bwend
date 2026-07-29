/**
 * Internal action for claiming an invite. Runs in Node.js so it can call the Spotify API
 * for the anchor track recommendation.
 *
 * This contains all the claim logic: validation, scoring, shared-name computation,
 * anchor-track selection, compatibility-read generation, and match insertion.
 */

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { score } from "./lib/vibeScore";
import type { SpotifyTrack } from "./lib/vibeScore";
import { readCompatibility } from "./lib/compatibilityReader";

interface ClaimResult {
  status: number;
  error: string | null;
  data: { matchId: string; vibeScore: number; breakdown: any } | null;
}

export const claim = internalAction({
  args: {
    code: v.string(),
    claimerSpotifyUserId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<ClaimResult> => {
    const invite: any = await ctx.runQuery(internal.inviteQueries.getByCode, { code: args.code });
    if (!invite) {
      return { status: 404, error: "Invite not found.", data: null };
    }

    if (invite.status !== "pending") {
      return { status: 409, error: "This invite is no longer claimable.", data: null };
    }

    if (invite.expiresAt < Date.now()) {
      await ctx.runMutation(internal.inviteMutations.updateStatus, {
        inviteId: invite._id,
        status: "expired",
      });
      return { status: 410, error: "This invite has expired.", data: null };
    }

    if (invite.inviterSpotifyUserId === args.claimerSpotifyUserId) {
      return { status: 400, error: "Can't claim your own invite.", data: null };
    }

    const inviterProfile: any = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
      spotifyUserId: invite.inviterSpotifyUserId,
    });
    const inviteeProfile: any = await ctx.runQuery(internal.bwendProfileQueries.getBySpotifyUserId, {
      spotifyUserId: args.claimerSpotifyUserId,
    });

    if (
      !inviterProfile ||
      !inviteeProfile ||
      inviterProfile.topTracks.length === 0 ||
      inviteeProfile.topTracks.length === 0
    ) {
      return { status: 421, error: "Both users must have connected Spotify first.", data: null };
    }

    // Compute the score.
    const result = score(
      inviterProfile.topTracks,
      inviterProfile.topArtists,
      inviterProfile.tasteProfile,
      inviteeProfile.topTracks,
      inviteeProfile.topArtists,
      inviteeProfile.tasteProfile
    );

    // Compute shared artist + track names.
    const inviteeArtistIds = new Set(inviteeProfile.topArtists.map((a: { id: string }) => a.id));
    const inviteeTrackIds = new Set(inviteeProfile.topTracks.map((t: { id: string }) => t.id));

    const sharedArtistNames: string[] = inviterProfile.topArtists
      .filter((a: { id: string }) => inviteeArtistIds.has(a.id))
      .slice(0, 10)
      .map((a: { name: string }) => a.name);

    const sharedTrackNames = inviterProfile.topTracks
      .filter((t: { id: string }) => inviteeTrackIds.has(t.id))
      .slice(0, 10)
      .map((t: { name: string }) => t.name);

    // Pick the anchor track (best-effort).
    const anchorTrack = pickAnchorTrack(inviterProfile, inviteeProfile);

    // Generate the compatibility read.
    const compatibilityRead = readCompatibility(result.breakdown, sharedArtistNames);

    // Insert the match.
    const now = Date.now();
    const matchId: string = await ctx.runMutation(internal.matchMutations.create, {
      inviteId: invite._id,
      userASpotifyUserId: invite.inviterSpotifyUserId,
      userBSpotifyUserId: args.claimerSpotifyUserId,
      vibeScore: result.score,
      breakdown: result.breakdown,
      anchorTrack,
      sharedTopArtistNames: sharedArtistNames,
      sharedTopTrackNames: sharedTrackNames,
      compatibilityRead,
      createdAt: now,
    });

    // Mark invite as claimed.
    await ctx.runMutation(internal.inviteMutations.markClaimed, {
      inviteId: invite._id,
      inviteeSpotifyUserId: args.claimerSpotifyUserId,
      claimedAt: now,
    });

    return {
      status: 200,
      error: null,
      data: {
        matchId,
        vibeScore: result.score,
        breakdown: result.breakdown,
      },
    };
  },
});

// MARK: - Anchor track selection

interface AnchorTrack {
  id: string;
  name: string;
  artistName: string | null;
  imageURL: string | null;
  spotifyURL: string | null;
}

/**
 * Pick "the song that brings you together."
 *
 * This used to ask Spotify's /recommendations for a track at the midpoint of both users'
 * audio profiles. That endpoint now 404s for this app (deprecated 2024-11-27), so the
 * anchor is chosen from the two libraries we already hold. No network call, which also
 * means it can't fail silently the way the old best-effort version did.
 *
 * Preference order, strongest connection first:
 *   1. A track both users have in their top 50 — literally shared.
 *   2. A track by an artist both users have in their top 50 — shared taste, one step out.
 *   3. Each user's single most-played track, preferring the higher-ranked of the two.
 */
function pickAnchorTrack(inviterProfile: any, inviteeProfile: any): AnchorTrack | null {
  const inviterTracks: SpotifyTrack[] = inviterProfile.topTracks ?? [];
  const inviteeTracks: SpotifyTrack[] = inviteeProfile.topTracks ?? [];

  // 1. Highest-ranked mutually-held track. Rank is summed across both users so a track
  //    they both rate highly wins over one that's #1 for a single person.
  const inviteeRank = new Map<string, number>();
  inviteeTracks.forEach((t, i) => {
    if (!inviteeRank.has(t.id)) inviteeRank.set(t.id, i);
  });

  let bestTrack: SpotifyTrack | null = null;
  let bestRank = Infinity;
  for (let rank = 0; rank < inviterTracks.length; rank++) {
    const track = inviterTracks[rank];
    const other = inviteeRank.get(track.id);
    if (other === undefined) continue;
    const combined = rank + other;
    if (combined < bestRank) {
      bestTrack = track;
      bestRank = combined;
    }
  }
  if (bestTrack !== null) return toAnchor(bestTrack);

  // 2. Highest-ranked track by a mutually-held artist, from either library.
  const inviterArtistIds = new Set<string>(
    (inviterProfile.topArtists ?? []).map((a: { id: string }) => a.id)
  );
  const inviteeArtistIds = new Set<string>(
    (inviteeProfile.topArtists ?? []).map((a: { id: string }) => a.id)
  );
  const sharedArtistIds = new Set(
    [...inviterArtistIds].filter((id) => inviteeArtistIds.has(id))
  );

  if (sharedArtistIds.size > 0) {
    // Walk both libraries in lockstep so neither user is systematically favoured.
    const maxLen = Math.max(inviterTracks.length, inviteeTracks.length);
    for (let i = 0; i < maxLen; i++) {
      for (const track of [inviterTracks[i], inviteeTracks[i]]) {
        if (!track) continue;
        if (track.artistIds?.some((id) => sharedArtistIds.has(id))) return toAnchor(track);
      }
    }
  }

  // 3. No shared ground at all — fall back to a top track so the reveal still has a song.
  return toAnchor(inviterTracks[0] ?? inviteeTracks[0] ?? null);
}

function toAnchor(track: SpotifyTrack | null): AnchorTrack | null {
  if (!track || !track.id || !track.name) return null;
  return {
    id: track.id,
    name: track.name,
    artistName: track.artistName ?? null,
    imageURL: track.imageURL ?? null,
    spotifyURL: track.spotifyURL ?? null,
  };
}
