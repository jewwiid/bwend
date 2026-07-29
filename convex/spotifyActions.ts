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
import {
  exchangeAuthCode,
  me,
  topTracks,
  topArtists,
  recentlyPlayed,
  encodeTokenBlob,
} from "./lib/spotify";
import { buildTasteProfile, describeSignals } from "./lib/vibeScore";
import { issueSession } from "./lib/jwt";

/**
 * Redirect URIs this backend will complete a token exchange for.
 *
 * Spotify requires the `redirect_uri` sent at token-exchange time to match the one used at
 * authorize time, so the client has to tell us which it used — iOS uses a custom scheme, the
 * web app uses an https callback. This MUST stay an allowlist: echoing back a caller-supplied
 * redirect URI unchecked would let anyone who can reach this endpoint mint a session against
 * a redirect they control.
 *
 * Extra entries come from SPOTIFY_ALLOWED_REDIRECT_URIS (comma-separated).
 */
function allowedRedirectURIs(): string[] {
  const configured = [
    process.env.SPOTIFY_REDIRECT_URI ?? "bwend://spotify-callback",
    ...(process.env.SPOTIFY_ALLOWED_REDIRECT_URIS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  ];
  return [...new Set(configured)];
}

export const connect = internalAction({
  args: {
    code: v.string(),
    codeVerifier: v.string(),
    // Optional: older app builds don't send it and get the default (iOS) URI.
    redirectUri: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const allowed = allowedRedirectURIs();
    const redirectURI = args.redirectUri ?? allowed[0];
    if (!allowed.includes(redirectURI)) {
      return {
        status: 400,
        error: "That redirect URI isn't allowed for this app.",
        data: null,
      };
    }

    if (!clientId || !clientSecret) {
      return { status: 500, error: "Spotify credentials not configured.", data: null };
    }

    // 1. Exchange the auth code for tokens (PKCE — verifier must match the challenge).
    let tokens;
    try {
      tokens = await exchangeAuthCode(args.code, args.codeVerifier, clientId, clientSecret, redirectURI);
    } catch {
      return { status: 400, error: "Spotify token exchange failed. Check your auth code.", data: null };
    }

    // 2. Fetch the user's data.
    //
    // Only /me and the two top-reads are called. The old flow also hit /audio-features here,
    // which Spotify now 403s for this app — that was the source of the 502 on connect.
    try {
      const meResp = await me(tokens.accessToken);
      const [tracks, artists] = await Promise.all([
        topTracks(tokens.accessToken),
        topArtists(tokens.accessToken),
      ]);

      // Extra windows and play history feed the discovery and clock components. All are
      // best-effort: none of them should be able to fail a connect, and a user who granted
      // only the original three scopes simply scores without those components.
      const canReadRecent = (tokens.scope ?? "").split(" ").includes("user-read-recently-played");

      const [shortTermArtists, longTermArtists, recent] = await Promise.all([
        topArtists(tokens.accessToken, "short_term").catch(() => undefined),
        topArtists(tokens.accessToken, "long_term").catch(() => undefined),
        canReadRecent
          ? recentlyPlayed(tokens.accessToken, 50).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);

      const tasteProfile = buildTasteProfile(tracks, artists, {
        shortTermArtists,
        longTermArtists,
        playedAt: recent?.playedAt,
      });
      const displayName = meResp.display_name ?? meResp.id;
      const tokenBlob = encodeTokenBlob(tokens);

      // Records which signals Spotify actually returned for this app. Genres and popularity
      // are being withdrawn on some object types, and the scorer drops whichever are absent.
      console.log(`spotify connect signals · ${describeSignals(tracks, artists, tasteProfile)}`);

      // 3. Upsert the profile.
      await ctx.runMutation(internal.bwendProfileMutations.upsert, {
        spotifyUserId: meResp.id,
        displayName,
        topTracks: tracks,
        topArtists: artists,
        tasteProfile,
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
