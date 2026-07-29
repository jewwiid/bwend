/**
 * Spotify API client.
 *
 * All methods use fetch. Token exchange happens once per user at connect time.
 *
 * ## Endpoints deliberately absent
 *
 * `/audio-features`, `/audio-analysis`, `/recommendations`, `/related-artists` and
 * `/artists/{id}/top-tracks` were deprecated by Spotify on 2024-11-27 and return a bare
 * 403/404 to any app created after that date. This client ID is one of them — verified
 * against the live API. Do not add them back: they cannot be re-enabled from the dashboard,
 * and extended quota mode does not restore them.
 *
 * `popularity`, `genres` and `preview_url` are likewise stripped. Confirmed empty on the
 * live top-reads for this app: every artist comes back `genres: []`, and `popularity` /
 * `preview_url` are absent from the payload entirely (the key is missing, not null). They
 * are parsed defensively here and surfaced as `null`/`[]` so the scorer can drop the
 * affected component rather than scoring missing data as zero.
 *
 * ## What IS still available
 *
 * Album art and artist images (640/320/160px), album name, every artist on a track,
 * duration, explicit flag, and open.spotify.com URLs — all verified present. These are the
 * only visual material Spotify still hands over, so they are captured in full.
 *
 * A bare 403 with no `message` is the deprecation signature. A 403 carrying
 * `"Insufficient client scope"` means the endpoint is alive and only needs the scope.
 */

"use node";

import type { SpotifyTrack, SpotifyArtist } from "./vibeScore";

const ACCOUNT_BASE = "https://accounts.spotify.com/api";
const API_BASE = "https://api.spotify.com/v1";

/** Spotify's three top-read windows: ~4 weeks, ~6 months, ~1 year+. */
export type TimeRange = "short_term" | "medium_term" | "long_term";

export const TIME_RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

export function asTimeRange(raw: string | null | undefined): TimeRange {
  return TIME_RANGES.includes(raw as TimeRange) ? (raw as TimeRange) : "medium_term";
}

export interface SpotifyTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope?: string;
}

interface SpotifyMeResponse {
  id: string;
  display_name?: string;
}

// MARK: - Token exchange

export async function exchangeAuthCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  redirectURI: string
): Promise<SpotifyTokenResponse> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectURI,
    // PKCE: the code_verifier must match the code_challenge sent at authorize time.
    code_verifier: codeVerifier,
  });

  const resp = await fetch(`${ACCOUNT_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Spotify token exchange failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
    scope: data.scope,
  };
}

// MARK: - User data

export async function me(token: string): Promise<SpotifyMeResponse> {
  const resp = await fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify /me failed: ${resp.status}`);
  return await resp.json();
}

/**
 * Top tracks, in rank order (index 0 = most played). Rank is load-bearing for scoring,
 * so the array order must be preserved downstream.
 */
export async function topTracks(
  token: string,
  timeRange: TimeRange = "medium_term"
): Promise<SpotifyTrack[]> {
  const resp = await fetch(
    `${API_BASE}/me/top/tracks?limit=50&time_range=${timeRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Spotify /top/tracks failed: ${resp.status}`);
  const data = await resp.json();
  return (data.items ?? []).map(mapTrack);
}

/** Top artists, in rank order (index 0 = most played). */
export async function topArtists(
  token: string,
  timeRange: TimeRange = "medium_term"
): Promise<SpotifyArtist[]> {
  const resp = await fetch(
    `${API_BASE}/me/top/artists?limit=50&time_range=${timeRange}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Spotify /top/artists failed: ${resp.status}`);
  const data = await resp.json();
  return (data.items ?? []).map(mapArtist);
}

export interface RecentPlays {
  /** De-duplicated by track id, newest first — for display. */
  tracks: SpotifyTrack[];
  /**
   * Epoch-ms timestamp of EVERY play, repeats included. Kept separate from `tracks` because
   * de-duplicating for display would throw away exactly what the listening clock measures:
   * when, and how often, someone actually listens.
   */
  playedAt: number[];
}

/**
 * Recently played tracks. Requires the `user-read-recently-played` scope.
 *
 * Spotify caps this at the last 50 plays, which is the ceiling on how much clock signal
 * a single connect can gather.
 */
export async function recentlyPlayed(token: string, limit = 50): Promise<RecentPlays> {
  const resp = await fetch(`${API_BASE}/me/player/recently-played?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify /recently-played failed: ${resp.status}`);
  const data = await resp.json();

  const seen = new Set<string>();
  const tracks: SpotifyTrack[] = [];
  const playedAt: number[] = [];

  for (const row of data.items ?? []) {
    const track = row?.track;
    if (!track?.id) continue;

    const ts = Date.parse(row?.played_at ?? "");
    if (Number.isFinite(ts)) playedAt.push(ts);

    if (seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(mapTrack(track));
  }

  return { tracks, playedAt };
}

/**
 * Total counts for the user's library. Each requires its own scope, and each is requested
 * with `limit=1` because only the `total` is used.
 *
 * Individually best-effort: a user who declined one scope still gets the others rather
 * than losing the whole section.
 */
export async function libraryCounts(token: string): Promise<{
  savedTracks: number | null;
  savedAlbums: number | null;
  playlists: number | null;
  followedArtists: number | null;
}> {
  const total = async (path: string, pick: (d: any) => unknown): Promise<number | null> => {
    try {
      const resp = await fetch(`${API_BASE}/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const value = pick(await resp.json());
      return typeof value === "number" ? value : null;
    } catch {
      return null;
    }
  };

  const [savedTracks, savedAlbums, playlists, followedArtists] = await Promise.all([
    total("me/tracks?limit=1", (d) => d?.total),
    total("me/albums?limit=1", (d) => d?.total),
    total("me/playlists?limit=1", (d) => d?.total),
    total("me/following?type=artist&limit=1", (d) => d?.artists?.total),
  ]);

  return { savedTracks, savedAlbums, playlists, followedArtists };
}

// MARK: - Object mapping

/**
 * Map a Spotify track object. Album art and the full artist list are captured here because
 * there is no way to backfill them later — /v1/tracks?ids= and /v1/artists?ids= are both
 * 403 for this app, so anything dropped at read time is gone.
 */
function mapTrack(item: any): SpotifyTrack {
  const artists = Array.isArray(item.artists) ? item.artists : [];
  return {
    id: item.id,
    name: item.name,
    artistIds: artists.map((a: any) => a.id),
    artistName: artists[0]?.name ?? null,
    artistNames: artists.map((a: any) => a.name).filter((n: unknown) => typeof n === "string"),
    albumName: item.album?.name ?? null,
    imageURL: largestImage(item.album?.images),
    spotifyURL: item.external_urls?.spotify ?? null,
    durationMs: numberOrNull(item.duration_ms),
    explicit: typeof item.explicit === "boolean" ? item.explicit : null,
    releaseYear: parseYear(item.album?.release_date),
    popularity: numberOrNull(item.popularity),
  };
}

function mapArtist(item: any): SpotifyArtist {
  return {
    id: item.id,
    name: item.name,
    genres: Array.isArray(item.genres) ? item.genres : [],
    imageURL: largestImage(item.images),
    spotifyURL: item.external_urls?.spotify ?? null,
    popularity: numberOrNull(item.popularity),
  };
}

/**
 * Pick the highest-resolution image. Spotify orders these largest-first, but that isn't
 * documented as a guarantee, so pick by width rather than trusting position.
 */
function largestImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  let best: { url?: string; width?: number } | null = null;
  for (const img of images) {
    if (!img?.url) continue;
    if (best === null || (img.width ?? 0) > (best.width ?? 0)) best = img;
  }
  return best?.url ?? null;
}

// MARK: - Token refresh

/**
 * Exchange a refresh token for a fresh access token.
 *
 * Spotify access tokens live one hour, so anything reading from Spotify after connect time
 * needs this. Spotify does not always return a new refresh token on this call — when it
 * doesn't, the existing one stays valid and must be carried forward, otherwise the user
 * gets silently logged out of Spotify an hour later.
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SpotifyTokenResponse> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const resp = await fetch(`${ACCOUNT_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Spotify token refresh failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? "Bearer",
    expiresIn: data.expires_in ?? 3600,
    // Carry the old refresh token forward when Spotify omits a new one.
    refreshToken: data.refresh_token ?? refreshToken,
    scope: data.scope,
  };
}

// MARK: - Token blob helpers (base64 JSON)

/**
 * Serialize tokens for storage.
 *
 * `expiresAt` is an ABSOLUTE epoch-ms timestamp, not the duration Spotify returns — a
 * stored duration is meaningless once written, since there is nothing to measure it from.
 */
export function encodeTokenBlob(tokens: SpotifyTokenResponse): string {
  const payload: Record<string, string> = {
    access: tokens.accessToken,
    expiresAt: String(Date.now() + tokens.expiresIn * 1000),
  };
  if (tokens.refreshToken) payload.refresh = tokens.refreshToken;
  if (tokens.scope) payload.scope = tokens.scope;
  return btoa(JSON.stringify(payload));
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  /** Epoch ms. Null for blobs written before absolute expiry was stored. */
  expiresAt: number | null;
}

export function decodeTokenBlob(blob: string): StoredTokens | null {
  try {
    const dict = JSON.parse(atob(blob));
    const expiresAt = dict.expiresAt ? parseInt(dict.expiresAt, 10) : NaN;
    return {
      accessToken: dict.access ?? "",
      refreshToken: dict.refresh,
      scope: dict.scope,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    };
  } catch {
    return null;
  }
}

/** 60s of slack so a token doesn't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

/**
 * True when the stored access token needs refreshing. A blob with no `expiresAt` (written
 * before this field existed) is treated as expired, which self-heals on the next read.
 */
export function isTokenExpired(tokens: StoredTokens): boolean {
  if (tokens.expiresAt === null) return true;
  return Date.now() >= tokens.expiresAt - EXPIRY_SKEW_MS;
}

/** True when the granted scope string covers `scope`. */
export function hasScope(tokens: StoredTokens, scope: string): boolean {
  return (tokens.scope ?? "").split(" ").includes(scope);
}

// MARK: - Helpers

/**
 * Parse a Spotify release_date into a (possibly fractional) year.
 * "YYYY" → year; "YYYY-MM" → year + (month-1)/12; "YYYY-MM-DD" → same fractional formula.
 * Ported from Swift parseYear().
 */
function parseYear(raw?: string): number | null {
  if (!raw) return null;
  const parts = raw.split("-");
  const year = parseFloat(parts[0]);
  if (isNaN(year)) return null;
  if (parts.length >= 2) {
    const month = parseFloat(parts[1]);
    if (!isNaN(month)) {
      return year + (month - 1) / 12.0;
    }
  }
  return year;
}

/**
 * Coerce a Spotify numeric field to a number, or null when the field is absent.
 *
 * Absent is meaningful: Spotify now omits `popularity` entirely for affected apps, and the
 * scorer must be able to tell "not provided" apart from a genuine 0.
 */
function numberOrNull(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}
