/**
 * Internal action for Spotify connect. Runs in Node.js so it can call the Spotify API.
 *
 * Exchanges the auth code, fetches the user's library, persists the profile, and mints
 * the Bwend session JWT.
 */

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { exchangeAuthCode, me, topTracks, topArtists, audioFeatures, encodeTokenBlob } from "./lib/spotify";
import { aggregateAudioProfile } from "./lib/vibeScore";
import { issueSession } from "./lib/jwt";

export const connect = internalAction({
  args: { code: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectURI = process.env.SPOTIFY_REDIRECT_URI ?? "bwend://spotify-callback";

    if (!clientId || !clientSecret) {
      return { status: 500, error: "Spotify credentials not configured.", data: null };
    }

    // 1. Exchange the auth code for tokens.
    let tokens;
    try {
      tokens = await exchangeAuthCode(args.code, clientId, clientSecret, redirectURI);
    } catch {
      return { status: 502, error: "Spotify token exchange failed.", data: null };
    }

    // 2. Fetch the user's data.
    try {
      const meResp = await me(tokens.accessToken);
      const tracks = await topTracks(tokens.accessToken);
      const artists = await topArtists(tokens.accessToken);
      const features = await audioFeatures(tracks.map((t) => t.id), tokens.accessToken);

      const audioProfile = aggregateAudioProfile(tracks, features);
      const displayName = meResp.display_name ?? meResp.id;
      const tokenBlob = encodeTokenBlob(tokens);

      // 3. Upsert the profile.
      await ctx.runMutation(internal.bwendProfileMutations.upsert, {
        spotifyUserId: meResp.id,
        displayName,
        topTracks: tracks,
        topArtists: artists,
        audioProfile,
        spotifyTokenBlob: tokenBlob,
      });

      // 4. Mint the session JWT.
      const sessionToken = await issueSession(meResp.id, displayName);

      return {
        status: 200,
        error: null,
        data: {
          token: sessionToken,
          spotifyId: meResp.id,
          displayName,
          topTrackCount: tracks.length,
          topArtistCount: artists.length,
        },
      };
    } catch (e) {
      return {
        status: 502,
        error: `Spotify data fetch failed: ${(e as Error).message}`,
        data: null,
      };
    }
  },
});
