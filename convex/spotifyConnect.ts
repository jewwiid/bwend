/**
 * Spotify connect — the auth entry point HTTP handler.
 * Delegates to an internal action for the Node-only work (Spotify API calls).
 * Does NOT import auth.ts or any "use node" modules directly.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { corsHeaders } from "./auth";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "./lib/privacyConstants";

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
  let body: {
    code?: string;
    codeVerifier?: string;
    redirectUri?: string;
    privacyConsentVersion?: string;
    privacyConsentGranted?: boolean;
    termsVersion?: string;
    termsAccepted?: boolean;
  };
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
  if (
    body.privacyConsentGranted !== true ||
    body.privacyConsentVersion !== CURRENT_PRIVACY_VERSION
  ) {
    return json(
      400,
      {
        reason: "Review and accept the current Bwend privacy notice before connecting Spotify.",
        code: "privacy_consent_required",
        privacyVersion: CURRENT_PRIVACY_VERSION,
      },
      request
    );
  }
  if (body.termsAccepted !== true || body.termsVersion !== CURRENT_TERMS_VERSION) {
    return json(
      400,
      {
        reason: "Review and accept the current Bwend Beta Terms before connecting Spotify.",
        code: "terms_acceptance_required",
        termsVersion: CURRENT_TERMS_VERSION,
      },
      request
    );
  }

  try {
    const result: any = await ctx.runAction(internal.spotifyActions.connect, {
      code,
      codeVerifier,
      // Omitted by older iOS builds; the action falls back to the default (iOS) URI.
      redirectUri: body.redirectUri,
      privacyConsentVersion: body.privacyConsentVersion,
      termsVersion: body.termsVersion,
    });
    if (result.error) {
      return json(result.status, { reason: result.error }, request);
    }
    return json(200, result.data, request);
  } catch (e) {
    console.error("Spotify connect failed", e);
    return json(500, { reason: "Couldn't connect Spotify right now. Please try again." }, request);
  }
});
