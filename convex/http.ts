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
import { handleCreateInvite, handleFetchInvite, handleClaimInvite } from "./invites";
import { handleListMatches, handleFetchMatch } from "./matches";

const http = httpRouter();

http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response("ok", { status: 200 });
  }),
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

// Invites — create (no dynamic segment).
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

// Invites — claim by code. The URL is /api/invites/<code>/claim.
// We can't nest pathPrefix easily, so we match the broader prefix and parse the path.
http.route({
  pathPrefix: "/api/invites/",
  method: "POST",
  handler: handleClaimInvite,
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

// CORS preflight. The browser sends OPTIONS before any request carrying an Authorization or
// Content-Type header, and Convex's router has no middleware layer — so each browser-reachable
// path needs its own OPTIONS route or the real request never leaves the browser.
const preflight = httpAction(async (_ctx, request) => preflightResponse(request));

for (const path of ["/api/auth/spotify", "/api/me/blend", "/api/invites", "/api/matches"]) {
  http.route({ path, method: "OPTIONS", handler: preflight });
}
for (const pathPrefix of ["/api/invites/", "/api/matches/"]) {
  http.route({ pathPrefix, method: "OPTIONS", handler: preflight });
}

export default http;
