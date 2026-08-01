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

export class SpotifyAPIError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly reason: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    endpoint: string,
    status: number,
    detail = "",
    reason: string | null = null,
    retryAfterSeconds: number | null = null
  ) {
    super(`Spotify ${endpoint} failed: ${status}${detail ? ` ${detail}` : ""}`);
    this.name = "SpotifyAPIError";
    this.endpoint = endpoint;
    this.status = status;
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Preserve Spotify's machine-readable quota reason without exposing raw upstream bodies to
 * clients. Development Mode now distinguishes QUOTA_EXCEEDED from ordinary rate limiting.
 */
export async function spotifyAPIError(
  endpoint: string,
  response: Response
): Promise<SpotifyAPIError> {
  const raw = await response.text().catch(() => "");
  let reason: string | null = null;
  let detail = "";
  try {
    const body = JSON.parse(raw);
    reason = typeof body?.error?.reason === "string" ? body.error.reason : null;
    detail = typeof body?.error?.message === "string" ? body.error.message.slice(0, 200) : "";
  } catch {
    detail = raw.slice(0, 200);
  }

  const retryHeader = response.headers.get("Retry-After");
  const parsedRetry = retryHeader ? Number.parseInt(retryHeader, 10) : Number.NaN;
  return new SpotifyAPIError(
    endpoint,
    response.status,
    detail,
    reason,
    Number.isFinite(parsedRetry) && parsedRetry >= 0 ? parsedRetry : null
  );
}

export function spotifyRateLimitFailure(error: unknown): {
  status: 429;
  error: string;
  code: "spotify_quota_exceeded" | "spotify_rate_limited";
} | null {
  if (!(error instanceof SpotifyAPIError) || error.status !== 429) return null;
  if (error.reason === "QUOTA_EXCEEDED") {
    return {
      status: 429,
      error: "Bwend has reached Spotify's current private-beta quota. Please try again later.",
      code: "spotify_quota_exceeded",
    };
  }
  const retryCopy =
    error.retryAfterSeconds !== null
      ? ` Try again in about ${error.retryAfterSeconds} seconds.`
      : " Please try again shortly.";
  return {
    status: 429,
    error: `Spotify is temporarily rate limiting requests.${retryCopy}`,
    code: "spotify_rate_limited",
  };
}

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
  if (!resp.ok) throw await spotifyAPIError("/me", resp);
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
  if (!resp.ok) throw await spotifyAPIError("/me/top/tracks", resp);
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
  if (!resp.ok) throw await spotifyAPIError("/me/top/artists", resp);
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

export interface NowPlaying {
  isPlaying: boolean;
  progressMs: number | null;
  fetchedAt: number;
  track: SpotifyTrack | null;
}

export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  isActive: boolean;
  isRestricted: boolean;
  volumePercent: number | null;
}

export interface PlaybackState {
  isPlaying: boolean;
  progressMs: number | null;
  fetchedAt: number;
  track: SpotifyTrack | null;
  device: SpotifyDevice | null;
}

export interface SpotifyDiscoveryItem {
  id: string;
  kind: "album" | "playlist";
  name: string;
  subtitle: string | null;
  imageURL: string | null;
  spotifyURL: string | null;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  imageURL: string | null;
  spotifyURL: string;
  trackCount: number;
  collaborative: boolean;
}

export interface SpotifyPlaylistRead extends SpotifyPlaylistSummary {
  tracksReadable: boolean;
  tracks: SpotifyTrack[];
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
  if (!resp.ok) throw await spotifyAPIError("/me/player/recently-played", resp);
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

/** Current track only. Requires user-read-currently-playing. A 204 means idle. */
export async function currentlyPlaying(token: string): Promise<NowPlaying | null> {
  const resp = await fetch(`${API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 204) return null;
  if (!resp.ok) throw await spotifyAPIError("/me/player/currently-playing", resp);
  const data = await resp.json();
  const item = data?.item;
  return {
    isPlaying: data?.is_playing === true,
    progressMs: numberOrNull(data?.progress_ms),
    fetchedAt: Date.now(),
    track: item?.type === "track" && item?.id ? mapTrack(item) : null,
  };
}

/** Playback plus active device. Requires user-read-playback-state. A 204 means idle. */
export async function playbackState(token: string): Promise<PlaybackState | null> {
  const resp = await fetch(`${API_BASE}/me/player`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 204) return null;
  if (!resp.ok) throw await spotifyAPIError("/me/player", resp);
  const data = await resp.json();
  const item = data?.item;
  const device = data?.device;
  return {
    isPlaying: data?.is_playing === true,
    progressMs: numberOrNull(data?.progress_ms),
    fetchedAt: Date.now(),
    track: item?.type === "track" && item?.id ? mapTrack(item) : null,
    device: device
      ? {
          id: typeof device.id === "string" ? device.id : null,
          name: typeof device.name === "string" ? device.name : "Spotify device",
          type: typeof device.type === "string" ? device.type : "unknown",
          isActive: device.is_active === true,
          isRestricted: device.is_restricted === true,
          volumePercent: numberOrNull(device.volume_percent),
        }
      : null,
  };
}

/** Available Spotify Connect devices. Requires user-read-playback-state. */
export async function availableDevices(token: string): Promise<SpotifyDevice[]> {
  const resp = await fetch(`${API_BASE}/me/player/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw await spotifyAPIError("/me/player/devices", resp);
  const data = await resp.json();
  return (Array.isArray(data?.devices) ? data.devices : []).map((device: any) => ({
    id: typeof device.id === "string" ? device.id : null,
    name: typeof device.name === "string" ? device.name : "Spotify device",
    type: typeof device.type === "string" ? device.type : "unknown",
    isActive: device.is_active === true,
    isRestricted: device.is_restricted === true,
    volumePercent: numberOrNull(device.volume_percent),
  }));
}

/** Track search used by track-led invites. */
export async function searchTracks(
  token: string,
  query: string,
  limit = 12
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    // Development Mode reduced the search maximum to 10 in February 2026.
    limit: String(Math.max(1, Math.min(limit, 10))),
  });
  const resp = await fetch(`${API_BASE}/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw await spotifyAPIError("/search", resp);
  const data = await resp.json();
  return (data?.tracks?.items ?? [])
    .filter((item: any) => item?.id && item?.name)
    .map(mapTrack);
}

/** Create a private playlist in the current user's account. */
export async function createPrivatePlaylist(
  token: string,
  name: string,
  description: string
): Promise<{ id: string; spotifyURL: string }> {
  const resp = await fetch(`${API_BASE}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, public: false }),
  });
  if (!resp.ok) {
    throw await spotifyAPIError("/me/playlists", resp);
  }
  const data = await resp.json();
  if (!data?.id || !data?.external_urls?.spotify) {
    throw new SpotifyAPIError("/me/playlists", 502, "missing playlist id or URL");
  }
  return { id: data.id, spotifyURL: data.external_urls.spotify };
}

/** Add track URIs to a playlist using Spotify's current /items path. */
export async function addPlaylistItems(
  token: string,
  playlistId: string,
  trackIds: string[]
): Promise<void> {
  const uris = [...new Set(trackIds)]
    .filter(Boolean)
    .slice(0, 100)
    .map((id) => `spotify:track:${id}`);
  if (uris.length === 0) return;
  const resp = await fetch(`${API_BASE}/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris }),
  });
  if (!resp.ok) {
    throw await spotifyAPIError(`/playlists/${playlistId}/items`, resp);
  }
}

/**
 * Playlists visible in the current user's own library. Bwend never guesses which one is a
 * Blend from its name: the user explicitly chooses it in the client.
 */
export async function currentUserPlaylists(
  token: string,
  limit = 50
): Promise<SpotifyPlaylistSummary[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 50));
  const resp = await fetch(`${API_BASE}/me/playlists?limit=${boundedLimit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw await spotifyAPIError("/me/playlists", resp);
  const data = await resp.json();
  return (Array.isArray(data?.items) ? data.items : [])
    .filter(
      (playlist: any) =>
        playlist?.id && playlist?.name && typeof playlist?.external_urls?.spotify === "string"
    )
    .map((playlist: any) => mapPlaylistSummary(playlist));
}

/**
 * Read a playlist the user selected from their own library. Spotify currently limits items
 * to playlists the user owns or collaborates on, so metadata may be readable while tracks
 * are not. That distinction is returned honestly instead of treating a 403 as empty music.
 */
export async function readSpotifyPlaylist(
  token: string,
  playlistId: string
): Promise<SpotifyPlaylistRead> {
  const encodedId = encodeURIComponent(playlistId);
  const detailsResponse = await fetch(`${API_BASE}/playlists/${encodedId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!detailsResponse.ok) {
    throw await spotifyAPIError(`/playlists/${playlistId}`, detailsResponse);
  }
  const details = await detailsResponse.json();
  const summary = mapPlaylistSummary(details);

  const itemsResponse = await fetch(`${API_BASE}/playlists/${encodedId}/items?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (itemsResponse.status === 403) {
    return { ...summary, tracksReadable: false, tracks: [] };
  }
  if (!itemsResponse.ok) {
    throw await spotifyAPIError(`/playlists/${playlistId}/items`, itemsResponse);
  }
  const items = await itemsResponse.json();
  const tracks = (Array.isArray(items?.items) ? items.items : [])
    .map((row: any) => row?.item ?? row?.track)
    .filter((track: any) => track?.type === "track" && track?.id && track?.name)
    .map(mapTrack);
  return {
    ...summary,
    trackCount: typeof items?.total === "number" ? items.total : summary.trackCount,
    tracksReadable: true,
    tracks,
  };
}

/** New releases and featured playlists for the post-match discovery rail. */
export async function discovery(token: string): Promise<SpotifyDiscoveryItem[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const [albumsResponse, playlistsResponse] = await Promise.all([
    fetch(`${API_BASE}/browse/new-releases?limit=8`, { headers }),
    fetch(`${API_BASE}/browse/featured-playlists?limit=6`, { headers }),
  ]);

  const items: SpotifyDiscoveryItem[] = [];
  if (albumsResponse.ok) {
    const data = await albumsResponse.json();
    for (const album of data?.albums?.items ?? []) {
      if (!album?.id || !album?.name) continue;
      items.push({
        id: album.id,
        kind: "album",
        name: album.name,
        subtitle: Array.isArray(album.artists)
          ? album.artists.map((artist: any) => artist?.name).filter(Boolean).join(", ") || null
          : null,
        imageURL: largestImage(album.images),
        spotifyURL: album.external_urls?.spotify ?? null,
      });
    }
  }
  if (playlistsResponse.ok) {
    const data = await playlistsResponse.json();
    for (const playlist of data?.playlists?.items ?? []) {
      if (!playlist?.id || !playlist?.name) continue;
      items.push({
        id: playlist.id,
        kind: "playlist",
        name: playlist.name,
        subtitle: playlist.description || null,
        imageURL: largestImage(playlist.images),
        spotifyURL: playlist.external_urls?.spotify ?? null,
      });
    }
  }
  if (items.length === 0 && (!albumsResponse.ok || !playlistsResponse.ok)) {
    throw await spotifyAPIError(
      "/browse",
      !albumsResponse.ok ? albumsResponse : playlistsResponse
    );
  }
  return items;
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
export function mapTrack(item: any): SpotifyTrack {
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

function mapPlaylistSummary(item: any): SpotifyPlaylistSummary {
  const spotifyURL = item?.external_urls?.spotify;
  if (!item?.id || !item?.name || typeof spotifyURL !== "string") {
    throw new SpotifyAPIError("/playlists", 502, "missing playlist metadata");
  }
  return {
    id: item.id,
    name: item.name,
    imageURL: largestImage(item.images),
    spotifyURL,
    trackCount:
      typeof item?.items?.total === "number"
        ? item.items.total
        : typeof item?.tracks?.total === "number"
          ? item.tracks.total
          : 0,
    collaborative: item.collaborative === true,
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

// MARK: - Token blob helpers (AES-256-GCM)

const TOKEN_BLOB_PREFIX = "enc.v1";

async function tokenEncryptionKey(): Promise<CryptoKey> {
  const encoded = process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY is not configured.");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (keyBytes.length !== 32) {
    throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function bytesToBase64URL(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64URLToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

/**
 * Serialize tokens for storage.
 *
 * `expiresAt` is an ABSOLUTE epoch-ms timestamp, not the duration Spotify returns — a
 * stored duration is meaningless once written, since there is nothing to measure it from.
 */
export async function encodeTokenBlob(tokens: SpotifyTokenResponse): Promise<string> {
  const payload: Record<string, string> = {
    access: tokens.accessToken,
    expiresAt: String(Date.now() + tokens.expiresIn * 1000),
  };
  if (tokens.refreshToken) payload.refresh = tokens.refreshToken;
  if (tokens.scope) payload.scope = tokens.scope;
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertextAndTag = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: nonce,
        additionalData: new TextEncoder().encode(TOKEN_BLOB_PREFIX),
        tagLength: 128,
      },
      await tokenEncryptionKey(),
      new TextEncoder().encode(JSON.stringify(payload))
    )
  );
  return [
    TOKEN_BLOB_PREFIX,
    bytesToBase64URL(nonce),
    bytesToBase64URL(ciphertextAndTag),
  ].join(".");
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  /** Epoch ms. Null for blobs written before absolute expiry was stored. */
  expiresAt: number | null;
  /** Legacy blobs are accepted once and encrypted on their next authenticated read. */
  storageVersion: "encrypted" | "legacy";
}

export async function decodeTokenBlob(blob: string): Promise<StoredTokens | null> {
  try {
    let dict: Record<string, string>;
    let storageVersion: StoredTokens["storageVersion"];
    if (blob.startsWith(`${TOKEN_BLOB_PREFIX}.`)) {
      const parts = blob.split(".");
      if (parts.length !== 4) return null;
      const nonce = base64URLToBytes(parts[2]).slice().buffer;
      const ciphertextAndTag = base64URLToBytes(parts[3]).slice().buffer;
      const plaintext = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          additionalData: new TextEncoder().encode(TOKEN_BLOB_PREFIX),
          tagLength: 128,
        },
        await tokenEncryptionKey(),
        ciphertextAndTag
      );
      dict = JSON.parse(new TextDecoder().decode(plaintext));
      storageVersion = "encrypted";
    } else {
      // Migration only. New writes never use this reversible base64 format.
      dict = JSON.parse(atob(blob));
      storageVersion = "legacy";
    }
    const expiresAt = dict.expiresAt ? parseInt(dict.expiresAt, 10) : NaN;
    return {
      accessToken: dict.access ?? "",
      refreshToken: dict.refresh,
      scope: dict.scope,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      storageVersion,
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
