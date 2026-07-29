/**
 * JWT — HS256 sign/verify using WebCrypto (crypto.subtle).
 *
 * Ported from Swift SessionJWT.swift. Same claims structure:
 *   { sub: spotifyUserId, name?, iss: "bwend", iat, exp }
 *
 * The secret comes from the BWEND_SESSION_SECRET env var (set in Convex dashboard).
 * Lifetime is 24 hours — matches the iOS app's session expectations.
 *
 * This module must work in BOTH the Convex runtime (httpActions) and Node.js (actions).
 * It avoids "use node" so httpActions can import it. Uses globalThis process if available.
 */

const ISSUER = "bwend";
const LIFETIME_MS = 60 * 60 * 24 * 1000; // 24 hours

interface SessionPayload {
  sub: string;
  name?: string;
  iss: string;
  iat: number;
  exp: number;
}

export interface SessionIdentity {
  spotifyUserId: string;
  name?: string;
}

function getSecret(): string {
  // process.env is available in both Convex httpActions and Node actions.
  const proc = globalThis as { process?: { env?: Record<string, string | undefined> } };
  const secret = proc.process?.env?.BWEND_SESSION_SECRET;
  if (!secret) {
    throw new Error("BWEND_SESSION_SECRET is not set. Set it in the Convex dashboard.");
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

/**
 * Mint a fresh session token for a Spotify user.
 */
export async function issueSession(
  spotifyUserId: string,
  displayName: string | null
): Promise<string> {
  const now = Date.now();
  const payload: SessionPayload = {
    sub: spotifyUserId,
    name: displayName ?? undefined,
    iss: ISSUER,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + LIFETIME_MS) / 1000),
  };

  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncodeString(JSON.stringify(header));
  const payloadB64 = base64UrlEncodeString(JSON.stringify(payload));

  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${signatureB64}`;
}

/**
 * Verify a session token and return the identity. Throws on invalid/expired/wrong issuer.
 */
export async function verifySession(token: string): Promise<SessionIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  // Verify signature.
  const key = await getKey();
  const signature = base64UrlDecode(signatureB64);
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer type mismatch.
  const sigBuf = new Uint8Array(signature).slice().buffer;
  const dataBuf = new TextEncoder().encode(signingInput);
  const valid = await crypto.subtle.verify("HMAC", key, sigBuf, dataBuf);
  if (!valid) {
    throw new Error("Invalid signature");
  }

  // Decode payload.
  const payload: SessionPayload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64))
  );

  // Check expiry.
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error("Token expired");
  }

  // Check issuer.
  if (payload.iss !== ISSUER) {
    throw new Error(`Wrong issuer: expected "${ISSUER}", got "${payload.iss}"`);
  }

  return { spotifyUserId: payload.sub, name: payload.name };
}
