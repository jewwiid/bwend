/**
 * HTTP router — exposes the iOS app's API as plain HTTPS endpoints on the Convex site URL.
 *
 * Base URL: https://helpful-owl-232.eu-west-1.convex.site
 * All endpoints are under /api/.
 *
 * Note: Convex's httpRouter does NOT support Express-style `:param` segments. For dynamic
 * paths like /api/invites/<code>, we use pathPrefix and parse the trailing segment from
 * request.url.
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { preflightResponse } from "./auth";
import { handleSpotifyConnect } from "./spotifyConnect";
import { handleMyBlend } from "./blend";
import {
  handleCancelInvite,
  handleClaimInvite,
  handleCreateInvite,
  handleFetchInvite,
  handleFetchInviteHandoff,
  handleListInvites,
} from "./invites";
import { handleListMatches, handleFetchMatch } from "./matches";
import {
  handleDiscovery,
  handleNowPlaying,
  handlePlayer,
  handleSearchTracks,
} from "./spotifyFeatures";
import { handleSaveMatchPlaylist } from "./playlists";
import {
  handleDisablePushDevice,
  handleRegisterPushDevice,
} from "./notifications";
import {
  handleDeleteAccount,
  handleDisconnectSpotify,
  handleExportAccount,
} from "./account";
import {
  handleDeleteListeningPortrait,
  handleGenerateListeningPortrait,
  handleGetListeningPortrait,
} from "./listeningPortrait";
import {
  handleDeleteSpotifyBlend,
  handleGetSpotifyBlend,
  handleSaveSpotifyBlend,
} from "./spotifyBlend";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "./lib/privacyConstants";

const http = httpRouter();

http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        ok: true,
        service: "bwend-api",
        privacyVersion: CURRENT_PRIVACY_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      }
    );
  }),
});

http.route({
  path: "/api/account/export",
  method: "GET",
  handler: handleExportAccount,
});

http.route({
  path: "/api/account/disconnect",
  method: "POST",
  handler: handleDisconnectSpotify,
});

http.route({
  path: "/api/account/delete",
  method: "POST",
  handler: handleDeleteAccount,
});

// Auth entry point — public (no existing session needed).
http.route({
  path: "/api/auth/spotify",
  method: "POST",
  handler: handleSpotifyConnect,
});

// The caller's own listening profile. Optional ?time_range= short_term|medium_term|long_term.
http.route({
  path: "/api/me/blend",
  method: "GET",
  handler: handleMyBlend,
});

http.route({
  path: "/api/me/spotify-blend",
  method: "GET",
  handler: handleGetSpotifyBlend,
});

http.route({
  path: "/api/me/spotify-blend",
  method: "POST",
  handler: handleSaveSpotifyBlend,
});

http.route({
  path: "/api/me/spotify-blend",
  method: "DELETE",
  handler: handleDeleteSpotifyBlend,
});

http.route({
  path: "/api/me/listening-portrait",
  method: "GET",
  handler: handleGetListeningPortrait,
});

http.route({
  path: "/api/me/listening-portrait",
  method: "POST",
  handler: handleGenerateListeningPortrait,
});

http.route({
  path: "/api/me/listening-portrait",
  method: "DELETE",
  handler: handleDeleteListeningPortrait,
});

http.route({
  path: "/api/me/now-playing",
  method: "GET",
  handler: handleNowPlaying,
});

http.route({
  path: "/api/me/player",
  method: "GET",
  handler: handlePlayer,
});

http.route({
  path: "/api/search/tracks",
  method: "GET",
  handler: handleSearchTracks,
});

http.route({
  path: "/api/discovery",
  method: "GET",
  handler: handleDiscovery,
});

http.route({
  path: "/api/notifications/device",
  method: "POST",
  handler: handleRegisterPushDevice,
});

http.route({
  path: "/api/notifications/device/disable",
  method: "POST",
  handler: handleDisablePushDevice,
});

// Invites — create (no dynamic segment).
http.route({
  path: "/api/invites",
  method: "GET",
  handler: handleListInvites,
});

http.route({
  path: "/api/invites",
  method: "POST",
  handler: handleCreateInvite,
});

// Invites — fetch by code. pathPrefix catches /api/invites/<code>.
http.route({
  pathPrefix: "/api/invites/",
  method: "GET",
  handler: handleFetchInvite,
});

http.route({
  pathPrefix: "/api/invite-handoffs/",
  method: "GET",
  handler: handleFetchInviteHandoff,
});

// Invites — claim by code. The URL is /api/invites/<code>/claim.
// We can't nest pathPrefix easily, so we match the broader prefix and parse the path.
http.route({
  pathPrefix: "/api/invites/",
  method: "POST",
  handler: handleClaimInvite,
});

http.route({
  pathPrefix: "/api/invites/",
  method: "DELETE",
  handler: handleCancelInvite,
});

// Matches — list (no dynamic segment).
http.route({
  path: "/api/matches",
  method: "GET",
  handler: handleListMatches,
});

// Matches — fetch by id. pathPrefix catches /api/matches/<id>.
http.route({
  pathPrefix: "/api/matches/",
  method: "GET",
  handler: handleFetchMatch,
});

http.route({
  pathPrefix: "/api/matches/",
  method: "POST",
  handler: handleSaveMatchPlaylist,
});

// CORS preflight. The browser sends OPTIONS before any request carrying an Authorization or
// Content-Type header, and Convex's router has no middleware layer — so each browser-reachable
// path needs its own OPTIONS route or the real request never leaves the browser.
const preflight = httpAction(async (_ctx, request) => preflightResponse(request));

for (const path of [
  "/api/auth/spotify",
  "/api/me/blend",
  "/api/me/spotify-blend",
  "/api/me/listening-portrait",
  "/api/me/now-playing",
  "/api/me/player",
  "/api/search/tracks",
  "/api/discovery",
  "/api/notifications/device",
  "/api/notifications/device/disable",
  "/api/invites",
  "/api/matches",
  "/api/account/export",
  "/api/account/disconnect",
  "/api/account/delete",
]) {
  http.route({ path, method: "OPTIONS", handler: preflight });
}
for (const pathPrefix of ["/api/invites/", "/api/invite-handoffs/", "/api/matches/"]) {
  http.route({ pathPrefix, method: "OPTIONS", handler: preflight });
}

export default http;
