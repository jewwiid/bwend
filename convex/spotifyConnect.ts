/**
 * Spotify connect — the auth entry point HTTP handler.
 * Delegates to an internal action for the Node-only work (Spotify API calls).
 * Does NOT import auth.ts or any "use node" modules directly.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { corsHeaders } from "./auth";

// Local helper rather than auth.ts's jsonResponse: this module deliberately avoids importing
// the JWT verification path, since connect is the endpoint that issues the session in the
// first place. corsHeaders is a pure header builder, so it's safe to share.
function json(status: number, body: unknown, request: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

export const handleSpotifyConnect = httpAction(async (ctx, request) => {
  let body: { code?: string; codeVerifier?: string; redirectUri?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { reason: "Invalid JSON body." }, request);
  }

  const code = body.code;
  const codeVerifier = body.codeVerifier;
  if (!code || !codeVerifier) {
    return json(400, { reason: "Missing 'code' or 'codeVerifier' in request body." }, request);
  }

  try {
    const result: any = await ctx.runAction(internal.spotifyActions.connect, {
      code,
      codeVerifier,
      // Omitted by older iOS builds; the action falls back to the default (iOS) URI.
      redirectUri: body.redirectUri,
    });
    if (result.error) {
      return json(result.status, { reason: result.error }, request);
    }
    return json(200, result.data, request);
  } catch (e) {
    return json(500, { reason: `Connect failed: ${(e as Error).message}` }, request);
  }
});
