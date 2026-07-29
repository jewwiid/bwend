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
 * Helper: send a JSON response with the given status code.
 */
export function jsonResponse(
  status: number,
  body: unknown
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
