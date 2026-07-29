/**
 * MusicBrainz + ListenBrainz clients.
 *
 * These supply what Spotify withdrew on 2024-11-27: genre tags and an artist-similarity
 * graph. Both are open, need no API key, and were verified against this app's real data.
 *
 * ## Rate limits are not optional
 *
 * MusicBrainz permits ONE request per second per client and enforces it. Exceeding it returns
 * 503s that look exactly like "artist not found" — an earlier probe here concluded Don Toliver
 * was missing from MusicBrainz when in fact the lookup had simply been throttled. Everything
 * calling in here must pace itself and must retry rather than treating a miss as absence.
 *
 * A descriptive User-Agent is required by MusicBrainz policy; requests without one get blocked.
 */

"use node";

const MB_BASE = "https://musicbrainz.org/ws/2";
const LB_BASE = "https://labs.api.listenbrainz.org";

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ?? "bwend/0.1 ( https://bwend.xyz )";

/** ListenBrainz's published similarity model. Pinned so scores stay comparable over time. */
const LB_ALGORITHM =
  "session_based_days_7500_session_300_contribution_5_threshold_10_limit_100_filter_True_skip_30";

/** MusicBrainz's documented floor. Everything here waits at least this long between calls. */
export const MB_MIN_INTERVAL_MS = 1100;

export interface SimilarArtist {
  mbid: string;
  name: string;
  score: number;
}

export interface ArtistEnrichment {
  mbid: string | null;
  genres: string[];
  country: string | null;
  similar: SimilarArtist[];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a Spotify artist name to a MusicBrainz artist, with its tags and country.
 *
 * Only accepts a confident match: MusicBrainz scores results 0–100 and happily returns
 * loosely-related artists for an unknown name, so a low-scoring hit is worse than no hit —
 * it would poison the genre vector with someone else's tags.
 */
export async function lookupArtist(name: string): Promise<{
  mbid: string;
  genres: string[];
  country: string | null;
} | null> {
  const params = new URLSearchParams({ query: `artist:"${name}"`, fmt: "json", limit: "3" });
  const resp = await fetch(`${MB_BASE}/artist?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  // 503 is MusicBrainz's throttle response. Surface it as an error so the caller retries
  // instead of recording the artist as missing.
  if (resp.status === 503) throw new Error("MusicBrainz throttled (503)");
  if (!resp.ok) throw new Error(`MusicBrainz lookup failed: ${resp.status}`);

  const data = await resp.json();
  const top = (data.artists ?? [])[0];
  if (!top?.id) return null;
  if (typeof top.score === "number" && top.score < 90) return null;

  return {
    mbid: top.id,
    genres: normalizeTags(top.tags),
    country: top.area?.name ?? top.country ?? null,
  };
}

/**
 * Artists commonly listened to alongside this one, from ListenBrainz's collaborative graph.
 *
 * Returns [] for artists the graph doesn't cover — coverage skews Western, and e.g. Zinoleesky
 * has no neighbours at all. That's a real gap, not an error, so it must not be retried forever.
 */
export async function similarArtists(mbid: string, limit = 60): Promise<SimilarArtist[]> {
  const url = `${LB_BASE}/similar-artists/json?artist_mbids=${encodeURIComponent(mbid)}&algorithm=${LB_ALGORITHM}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ListenBrainz similar-artists failed: ${resp.status}`);

  const body = await resp.json();
  // The labs API wraps results in an array whose last element holds `data`.
  const rows = Array.isArray(body)
    ? body.length > 0 && body[body.length - 1]?.data
      ? body[body.length - 1].data
      : body
    : [];

  const out: SimilarArtist[] = [];
  for (const row of rows) {
    if (!row?.artist_mbid || typeof row.score !== "number") continue;
    out.push({ mbid: row.artist_mbid, name: row.name ?? "", score: row.score });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Tags worth keeping.
 *
 * MusicBrainz tags are unmoderated user submissions — Drake comes back tagged `lesbian`, and
 * decade tags like `2010s` duplicate what the era component already measures. Requiring a
 * positive vote count and dropping non-genre noise keeps someone else's opinion out of a
 * user's profile.
 */
function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const out: string[] = [];
  for (const tag of raw) {
    const name = String(tag?.name ?? "").trim().toLowerCase();
    if (!name) continue;
    if (typeof tag?.count === "number" && tag.count < 1) continue;
    if (DECADE_TAG.test(name)) continue;
    if (NON_GENRE_TAGS.has(name)) continue;
    if (name.length > 40) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out.slice(0, 12);
}

const DECADE_TAG = /^(19|20)\d0s$/;

/**
 * Tags that describe the person rather than the music. Genre vectors built from these would
 * cluster users on the artist's demographics, which is both useless for taste and a thing we
 * should not be doing.
 */
const NON_GENRE_TAGS = new Set([
  "male", "female", "man", "woman", "non-binary", "transgender",
  "gay", "lesbian", "bisexual", "queer", "straight",
  "american", "british", "canadian", "nigerian", "australian",
  "rapper", "singer", "songwriter", "producer", "dj", "band", "group", "solo",
  "seen live", "favorites", "favourite", "good", "awesome",
]);
