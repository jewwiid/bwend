/**
 * Spotify OAuth (Authorization Code + PKCE) for the browser.
 *
 * Mirrors the iOS SpotifyAuth flow. The client secret never touches the browser — the code
 * is posted to our backend, which performs the token exchange and returns a Bwend session
 * JWT. The browser only ever holds that session token, never a Spotify token.
 *
 * The redirect URI must be registered in the Spotify dashboard and must match byte-for-byte
 * at both authorize and token-exchange time, which is why it's derived from window.location
 * and sent along to the backend rather than assumed on either side.
 */

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";

/** Same scopes as iOS, so a user's profile is identical whichever client they connect from. */
export const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-top-read",
  "user-read-recently-played",
  "user-library-read",
  "playlist-read-private",
  "user-follow-read",
  "user-read-currently-playing",
  "user-read-playback-state",
  "playlist-modify-private",
].join(" ");

const VERIFIER_KEY = "bwend.pkce.verifier";
const STATE_KEY = "bwend.pkce.state";
const RETURN_KEY = "bwend.postAuthReturn";

export function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

/**
 * Begin the OAuth flow.
 *
 * `returnTo` is stashed so an invite link survives the round trip — someone landing on
 * /m/abc123 should come back to that invite after connecting, not to a generic home screen.
 */
export async function beginSpotifyLogin(returnTo?: string): Promise<void> {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Missing VITE_SPOTIFY_CLIENT_ID. Add it to your Vercel env vars and .env.local.",
    );
  }

  const verifier = randomString(64);
  const challenge = await codeChallenge(verifier);
  const state = randomString(16);

  // sessionStorage, not localStorage: the verifier is single-use and scoped to this tab's
  // flow. A stale verifier in another tab would fail the exchange in a confusing way.
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES,
  });

  window.location.href = `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface CallbackParams {
  code: string;
  codeVerifier: string;
  returnTo: string | null;
}

/**
 * Validate the callback and hand back what the token exchange needs.
 *
 * Throws with a human-readable message on every failure path — a mismatched `state` means
 * the response didn't originate from a flow this tab started, and must not be exchanged.
 */
export function consumeCallback(search: string): CallbackParams {
  const params = new URLSearchParams(search);

  const error = params.get("error");
  if (error) {
    throw new Error(
      error === "access_denied"
        ? "You didn't approve access to Spotify."
        : `Spotify returned an error: ${error}`,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const returnTo = sessionStorage.getItem(RETURN_KEY);

  // One-shot: clear before validating so a failed attempt can't be replayed by reloading.
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_KEY);

  if (!code) throw new Error("Spotify didn't return an authorization code.");
  if (!verifier) {
    throw new Error("This sign-in link has expired. Start again from the home page.");
  }
  if (!state || state !== expectedState) {
    throw new Error("Sign-in couldn't be verified. Start again from the home page.");
  }

  return { code, codeVerifier: verifier, returnTo };
}

// MARK: - PKCE primitives

/** base64url of `bytes` random bytes — the PKCE verifier. */
function randomString(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf.buffer);
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
