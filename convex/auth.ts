/**
 * Auth helper for HTTP actions.
 *
 * Reads the Bearer JWT from the Authorization header, verifies it via lib/jwt.ts,
 * and returns the {spotifyUserId, name} identity. Invalid/expired → null (caller returns 401).
 */

import { verifySession, type SessionIdentity } from "./lib/jwt";

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function authenticate(request: Request): Promise<SessionIdentity | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

/**
 * Browser origins allowed to call this API.
 *
 * The web app runs on a different origin to the Convex deployment, so every response needs
 * CORS headers or the browser drops it. Auth is a Bearer token rather than a cookie, so
 * credentials are never sent cross-origin and an allowlist is enough.
 *
 * Extra origins come from WEB_ALLOWED_ORIGINS (comma-separated).
 */
function allowedOrigins(): string[] {
  const configured = [
    "https://www.bwend.xyz",
    "https://bwend.xyz",
    "http://localhost:5173",
    ...(process.env.WEB_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  ];
  return [...new Set(configured)];
}

/**
 * CORS headers for a request, echoing the Origin only when it's on the allowlist.
 *
 * Vary: Origin matters — without it a cache could serve one origin's CORS header to another.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Helper: send a JSON response with the given status code.
 *
 * Pass `request` so the response carries CORS headers. It's optional only so existing
 * non-browser callers keep working unchanged.
 */
export function jsonResponse(
  status: number,
  body: unknown,
  request?: Request
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(request ? corsHeaders(request) : {}),
    },
  });
}

/** Preflight handler shared by every browser-reachable route. */
export function preflightResponse(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/**
 * Helper: require auth or return 401. Returns identity or sends a 401 response.
 */
export async function requireAuth(
  request: Request
): Promise<SessionIdentity | Response> {
  const identity = await authenticate(request);
  if (!identity) {
    return jsonResponse(401, { reason: "Invalid or expired session token." });
  }
  return identity;
}
