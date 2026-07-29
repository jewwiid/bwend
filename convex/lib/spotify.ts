/**
 * Spotify API client — ported from Swift SpotifyService.swift.
 *
 * All methods use fetch. Token exchange happens once per user at connect time.
 * Methods mirror the Swift implementation exactly: same endpoints, same response parsing,
 * same fractional releaseYear logic, same batched audio-features fetching.
 */

"use node";

import type {
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAudioFeatures,
  AudioProfile,
} from "./vibeScore";

const ACCOUNT_BASE = "https://accounts.spotify.com/api";
const API_BASE = "https://api.spotify.com/v1";

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
  clientId: string,
  clientSecret: string,
  redirectURI: string
): Promise<SpotifyTokenResponse> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectURI,
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
    throw new Error(`Spotify token exchange failed: ${resp.status}`);
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

export async function topTracks(token: string): Promise<SpotifyTrack[]> {
  const resp = await fetch(
    `${API_BASE}/me/top/tracks?limit=50&time_range=medium_term`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Spotify /top/tracks failed: ${resp.status}`);
  const data = await resp.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    artistIds: (item.artists ?? []).map((a: any) => a.id),
    releaseYear: parseYear(item.album?.release_date),
  }));
}

export async function topArtists(token: string): Promise<SpotifyArtist[]> {
  const resp = await fetch(
    `${API_BASE}/me/top/artists?limit=50&time_range=medium_term`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Spotify /top/artists failed: ${resp.status}`);
  const data = await resp.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    name: item.name,
    genres: item.genres ?? [],
  }));
}

/**
 * Batched /audio-features call. Spotify accepts up to 100 ids per request.
 */
export async function audioFeatures(
  trackIds: string[],
  token: string
): Promise<SpotifyAudioFeatures[]> {
  if (trackIds.length === 0) return [];

  const out: SpotifyAudioFeatures[] = [];
  // Chunk into groups of 100.
  for (let i = 0; i < trackIds.length; i += 100) {
    const chunk = trackIds.slice(i, i + 100);
    const ids = chunk.join(",");
    const resp = await fetch(`${API_BASE}/audio-features?ids=${encodeURIComponent(ids)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Spotify /audio-features failed: ${resp.status}`);
    const data = await resp.json();
    for (const f of data.audio_features ?? []) {
      // Skip if any field is null (matches Swift behavior).
      if (
        f.energy == null ||
        f.valence == null ||
        f.tempo == null ||
        f.danceability == null
      ) {
        continue;
      }
      out.push({
        id: f.id,
        energy: f.energy,
        valence: f.valence,
        tempo: f.tempo,
        danceability: f.danceability,
      });
    }
  }
  return out;
}

interface RecommendationTrack {
  id: string;
  name?: string;
  uri?: string;
  artists?: { id: string; name?: string }[];
}

/**
 * Request recommendations based on seed artists/tracks and target audio attributes.
 * Ported from Swift: target_tempo is rounded to int, others are 3-decimal floats.
 */
export async function recommendations(
  seedArtistIds: string[],
  seedTrackIds: string[],
  target: AudioProfile,
  limit: number,
  token: string
): Promise<RecommendationTrack[]> {
  const totalSeeds = seedArtistIds.length + seedTrackIds.length;
  if (totalSeeds < 1 || totalSeeds > 5) {
    throw new Error(`Recommendations require 1–5 seeds total, got ${totalSeeds}`);
  }

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (seedArtistIds.length > 0) {
    params.set("seed_artists", seedArtistIds.join(","));
  }
  if (seedTrackIds.length > 0) {
    params.set("seed_tracks", seedTrackIds.join(","));
  }
  // 3-decimal float formatting, matching Swift's String(format: "%.3f").
  params.set("target_energy", fmt(target.energy));
  params.set("target_valence", fmt(target.valence));
  params.set("target_danceability", fmt(target.danceability));
  // Tempo is rounded to int.
  params.set("target_tempo", String(Math.round(target.tempo)));

  const resp = await fetch(`${API_BASE}/recommendations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify /recommendations failed: ${resp.status}`);
  const data = await resp.json();
  return data.tracks ?? [];
}

// MARK: - Token blob helpers (base64 JSON, matches Swift encodeTokenBlob/decodeTokenBlob)

export function encodeTokenBlob(tokens: SpotifyTokenResponse): string {
  const payload: Record<string, string> = {
    access: tokens.accessToken,
    expires: String(tokens.expiresIn),
  };
  if (tokens.refreshToken) payload.refresh = tokens.refreshToken;
  if (tokens.scope) payload.scope = tokens.scope;
  return btoa(JSON.stringify(payload));
}

export function decodeTokenBlob(blob: string): SpotifyTokenResponse | null {
  try {
    const dict = JSON.parse(atob(blob));
    return {
      accessToken: dict.access ?? "",
      tokenType: "Bearer",
      expiresIn: parseInt(dict.expires ?? "3600", 10),
      refreshToken: dict.refresh,
      scope: dict.scope,
    };
  } catch {
    return null;
  }
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
 * Format a number to exactly 3 decimal places with a dot separator.
 * Matches Swift's String(format: "%.3f", value).
 */
function fmt(n: number): string {
  return n.toFixed(3);
}
