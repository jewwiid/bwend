/**
 * Client for the Bwend HTTP API (the Convex site URL).
 *
 * Mirrors the iOS APIClient: same endpoints, same DTO shapes, same Bearer-token auth. The
 * session JWT lives in localStorage so a reload keeps you signed in.
 */

const BASE_URL = `${import.meta.env.VITE_CONVEX_SITE_URL}/api`;
const SESSION_KEY = "bwend.session";

// MARK: - Session

export interface Session {
  token: string;
  displayName: string | null;
  spotifyId: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// MARK: - Types (mirroring the iOS DTOs)

export interface SpotifyConnectResponse {
  token: string;
  spotifyId: string;
  displayName: string | null;
  topTrackCount: number;
  topArtistCount: number;
}

export interface BlendArtist {
  id: string;
  name: string;
  imageURL: string | null;
  spotifyURL: string | null;
}

export interface BlendTrack {
  id: string;
  name: string;
  artistName: string | null;
  artistNames: string[];
  albumName: string | null;
  imageURL: string | null;
  spotifyURL: string | null;
  durationMs: number | null;
  explicit: boolean | null;
  releaseYear: number | null;
}

export interface LibraryCounts {
  savedTracks: number | null;
  savedAlbums: number | null;
  playlists: number | null;
  followedArtists: number | null;
}

export interface BlendResponse {
  displayName: string | null;
  timeRange: string;
  era: number | null;
  topArtists: BlendArtist[];
  topTracks: BlendTrack[];
  recentlyPlayed: BlendTrack[] | null;
  library: LibraryCounts;
}

export interface ArtistBrief {
  id: string;
  name: string;
  imageURL: string | null;
}

export interface InvitePreview {
  code: string;
  inviterName: string | null;
  inviterTopArtists: string[];
  inviterArtists: ArtistBrief[] | null;
  expiresAt: string;
  alreadyClaimed: boolean;
  isMine: boolean;
}

export interface VibeBreakdown {
  trackOverlap: number;
  artistOverlap: number;
  genreOverlap: number | null;
  popularitySim: number | null;
  eraSim: number | null;
  /** How similarly the two of you chase new music vs stay loyal. */
  discoverySim: number | null;
  /** Overlap in the hours you actually listen. Null without the recently-played scope. */
  clockSim: number | null;
}

export interface AnchorTrack {
  id: string;
  name: string;
  artistName: string | null;
  imageURL: string | null;
  spotifyURL: string | null;
}

export interface ClaimResponse {
  matchId: string;
  vibeScore: number;
  breakdown: VibeBreakdown;
}

export interface PublicMatch {
  id: string;
  vibeScore: number;
  breakdown: VibeBreakdown;
  myName: string | null;
  partnerName: string | null;
  anchorTrack: AnchorTrack | null;
  sharedTopArtistNames: string[];
  sharedTopTrackNames: string[];
  compatibilityRead: string;
  createdAt: string;
}

export interface CreateInviteResponse {
  code: string;
  url: string;
  expiresAt: string;
}

export interface MatchSummary {
  id: string;
  partnerName: string | null;
  vibeScore: number;
  anchorTrackName: string | null;
  createdAt: string;
}

export type TimeRange = "short_term" | "medium_term" | "long_term";

/** An API failure carrying the server's `reason` where one was provided. */
export class ApiError extends Error {
  // Declared and assigned separately rather than as constructor parameter properties —
  // the project builds with `erasableSyntaxOnly`, which disallows those.
  readonly status: number;
  /** Machine-readable server code, when one was sent. See `requiresReconnect`. */
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** Only a fresh Spotify authorization can fix this. */
  get requiresReconnect(): boolean {
    return this.status === 401 || this.code === "reconnect_required";
  }
}

// MARK: - Requests

async function request<T>(
  path: string,
  init: RequestInit = {},
  authed = true,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };

  if (authed) {
    const session = loadSession();
    if (!session) throw new ApiError("Please connect Spotify to continue.", 401);
    headers.Authorization = `Bearer ${session.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Couldn't reach Bwend. Check your connection.", 0);
  }

  const text = await response.text();

  if (!response.ok) {
    let reason = `Something went wrong (${response.status}).`;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.reason === "string") reason = parsed.reason;
      if (typeof parsed?.code === "string") code = parsed.code;
    } catch {
      // Non-JSON body (a proxy or gateway error) — keep the generic message.
    }

    // Drop the session when nothing can be behind it any more, so the UI falls back to the
    // connect screen instead of looping on requests that can never succeed. Keyed on the
    // server's `code`, not the status — a 404 from /invites is a bad link, not a dead account.
    if (response.status === 401 || code === "reconnect_required") clearSession();

    throw new ApiError(reason, response.status, code);
  }

  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function connectSpotify(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<SpotifyConnectResponse> {
  return request(
    "/auth/spotify",
    { method: "POST", body: JSON.stringify({ code, codeVerifier, redirectUri }) },
    false,
  );
}

export function myBlend(timeRange: TimeRange = "medium_term"): Promise<BlendResponse> {
  return request(`/me/blend?time_range=${timeRange}`);
}

export function createInvite(): Promise<CreateInviteResponse> {
  return request("/invites", { method: "POST", body: "{}" });
}

export function fetchInvite(code: string): Promise<InvitePreview> {
  return request(`/invites/${encodeURIComponent(code)}`);
}

export function claimInvite(code: string): Promise<ClaimResponse> {
  return request(`/invites/${encodeURIComponent(code)}/claim`, {
    method: "POST",
    body: "{}",
  });
}

export function fetchMatch(id: string): Promise<PublicMatch> {
  return request(`/matches/${encodeURIComponent(id)}`);
}

export function myMatches(): Promise<MatchSummary[]> {
  return request("/matches");
}

// MARK: - Formatting helpers

export function creditLine(track: BlendTrack): string {
  return track.artistNames.length > 0
    ? track.artistNames.join(", ")
    : (track.artistName ?? "");
}

export function durationText(track: BlendTrack): string {
  if (!track.durationMs || track.durationMs <= 0) return "";
  const total = Math.floor(track.durationMs / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
