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
import type { AudioProfile } from "./lib/vibeScore";
import { readCompatibility } from "./lib/compatibilityReader";
import { recommendations, decodeTokenBlob } from "./lib/spotify";

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
      inviterProfile.audioProfile,
      inviteeProfile.topTracks,
      inviteeProfile.topArtists,
      inviteeProfile.audioProfile
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
    const anchorTrack = await pickAnchorTrack(inviterProfile, inviteeProfile);

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

async function pickAnchorTrack(
  inviterProfile: any,
  inviteeProfile: any
): Promise<{ id: string; name: string; artistName: string | null } | null> {
  const inviterArtistIds: string[] = inviterProfile.topArtists.map((a: { id: string }) => a.id);
  const inviteeArtistIds: string[] = inviteeProfile.topArtists.map((a: { id: string }) => a.id);
  const inviteeIdSet = new Set(inviteeArtistIds);
  const sharedArtistIds = inviterArtistIds.filter((id) => inviteeIdSet.has(id)).slice(0, 5);

  let seedArtistIds = sharedArtistIds;
  if (seedArtistIds.length === 0) {
    const combined: string[] = [];
    const maxLen = Math.max(inviterArtistIds.length, inviteeArtistIds.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < inviterArtistIds.length) combined.push(inviterArtistIds[i]);
      if (i < inviteeArtistIds.length) combined.push(inviteeArtistIds[i]);
      if (combined.length >= 5) break;
    }
    seedArtistIds = combined.slice(0, 5);
  }
  if (seedArtistIds.length === 0) return null;

  const a = inviterProfile.audioProfile as AudioProfile;
  const b = inviteeProfile.audioProfile as AudioProfile;
  const midpoint: AudioProfile = {
    energy: (a.energy + b.energy) / 2,
    valence: (a.valence + b.valence) / 2,
    tempo: (a.tempo + b.tempo) / 2,
    danceability: (a.danceability + b.danceability) / 2,
    era: (a.era + b.era) / 2,
  };

  if (!inviterProfile.spotifyTokenBlob) return null;
  const tokens = decodeTokenBlob(inviterProfile.spotifyTokenBlob);
  if (!tokens) return null;

  try {
    const tracks = await recommendations(seedArtistIds, [], midpoint, 1, tokens.accessToken);
    const first = tracks[0];
    if (!first || !first.name || !first.artists?.[0]) return null;
    return {
      id: first.id,
      name: first.name,
      artistName: first.artists[0].name ?? null,
    };
  } catch {
    return null;
  }
}
