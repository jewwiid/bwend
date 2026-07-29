/**
 * Converts Spotify's stable account id into a deterministic Bwend-only identifier.
 *
 * The HMAC prevents database exports from being joined directly back to Spotify ids. This is
 * pseudonymisation, not anonymisation: Bwend still treats the resulting value as personal data.
 */
export async function pseudonymousUserId(spotifyUserId: string): Promise<string> {
  const secret = process.env.BWEND_ID_SECRET;
  if (!secret) throw new Error("BWEND_ID_SECRET is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(spotifyUserId))
  );
  const digest = btoa(String.fromCharCode(...signature))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `bw_${digest}`;
}

/** A non-identifying label used instead of importing a person's Spotify display name. */
export function privateAlias(userId: string): string {
  return `Listener ${userId.slice(-4).toUpperCase()}`;
}
