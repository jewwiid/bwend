const SPOTIFY_BLEND_HOST = "open.spotify.com";
const MAX_INPUT_LENGTH = 2_048;
const MAX_TOKEN_LENGTH = 128;

/**
 * Accept either a bare Spotify Blend URL or the full sentence copied from a share sheet.
 * Bwend never fetches this URL. It stores a canonical deep link and hands it back to the
 * Spotify app only after the user intentionally attaches it to their Taste Card.
 */
export function normalizeSpotifyBlendURL(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_INPUT_LENGTH) return null;

  const match = trimmed.match(/https:\/\/open\.spotify\.com\/[^\s<>"']+/i);
  if (!match) return null;

  // Sentence punctuation is commonly included when users paste the complete share message.
  const candidate = match[0].replace(/[),.!?\]}]+$/g, "");

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== SPOTIFY_BLEND_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (
    parts.length !== 3 ||
    parts[0].toLowerCase() !== "blend" ||
    parts[1].toLowerCase() !== "taste-match" ||
    !/^[A-Za-z0-9_-]{8,128}$/.test(parts[2])
  ) {
    return null;
  }

  const canonical = new URL(
    `https://${SPOTIFY_BLEND_HOST}/blend/taste-match/${parts[2]}`
  );
  for (const key of ["si", "fallback", "blendDecoration"] as const) {
    const value = parsed.searchParams.get(key);
    if (value && value.length <= MAX_TOKEN_LENGTH) canonical.searchParams.set(key, value);
  }
  return canonical.toString();
}
