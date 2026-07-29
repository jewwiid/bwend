/**
 * VibeScoreEngine — scores two listeners against each other.
 *
 * Pure functions, zero I/O.
 *
 * ## Why this no longer uses audio features
 *
 * The original engine weighted energy/valence/tempo at a combined 0.40, sourced from
 * Spotify's `/v1/audio-features`. Spotify deprecated that endpoint (along with
 * `/recommendations`, `/audio-analysis`, `/related-artists` and artist `genres`/`popularity`
 * on some object types) on 2024-11-27. Apps created after that date receive a bare 403/404
 * forever — there is no dashboard toggle and extended quota mode does not restore it.
 *
 * Everything here is therefore derived from what the top-reads still return:
 * track/artist ids, their RANK, album release dates, and — where Spotify still provides
 * them — artist genres and popularity.
 *
 * ## Weights
 *
 *   track overlap     · 0.25   (rank-weighted)
 *   artist overlap    · 0.25   (rank-weighted)
 *   genre overlap     · 0.20   (cosine over the genre vector)
 *   popularity match  · 0.15   (mainstream ↔ niche)
 *   era match         · 0.15   (mean release year)
 *
 * Any component whose underlying data is missing on either side is reported as `null` and
 * DROPPED, with the surviving weights renormalized to sum to 1.0. This matters: the naive
 * alternative (treat missing as 0) scores `similarity(0, 0) = 1.0` and silently gifts every
 * pair the full weight of the missing component.
 */

export interface SpotifyTrack {
  id: string;
  name: string;
  artistIds: string[];
  /** Primary artist display name, captured inline from the top-tracks payload. */
  artistName: string | null;
  /** Every credited artist, for "with X" style display. */
  artistNames: string[];
  albumName: string | null;
  /** Highest-resolution album art (640px). The only artwork source we get — see spotify.ts. */
  imageURL: string | null;
  /** open.spotify.com link, for handing the user off to the Spotify app. */
  spotifyURL: string | null;
  durationMs: number | null;
  explicit: boolean | null;
  releaseYear: number | null;
  /** 0–100. Null when Spotify omits the field for this app (it does). */
  popularity: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  /** Confirmed empty on this app's top-reads — Spotify stopped populating it. */
  genres: string[];
  /** Highest-resolution artist photo (640px). */
  imageURL: string | null;
  spotifyURL: string | null;
  /** 0–100. Null when Spotify omits the field for this app (it does). */
  popularity: number | null;
}

/** A weighted genre term. Weights are normalized so the vector sums to 1. */
export interface GenreWeight {
  name: string;
  weight: number;
}

/**
 * The per-user listening fingerprint, computed once at connect time.
 *
 * Replaces the old AudioProfile (energy/valence/tempo/danceability/era).
 */
export interface TasteProfile {
  /** Descending by weight. Empty when Spotify returns no genres for this app. */
  genres: GenreWeight[];
  /** Mean popularity in 0..1. Null when Spotify omits popularity entirely. */
  popularity: number | null;
  /** Mean (possibly fractional) release year. Null when no release dates were parseable. */
  era: number | null;
  /**
   * Standard deviation of release years. Distinguishes someone ranging 1971–2024 from
   * someone entirely inside 2023 — two listeners who can share a mean era and have nothing
   * else in common.
   */
  eraSpread: number | null;
  /**
   * 0 = plays the same artists for years, 1 = this month looks nothing like all-time.
   * Derived from how far the short-term top artists have drifted from the long-term ones.
   */
  discovery: number | null;
  /**
   * 24 bins, one per hour, summing to 1 — when this person actually listens.
   *
   * Timestamps are UTC and Spotify never tells us the user's timezone, so this is only
   * comparable between people in the same one. That's the normal case for dating, where
   * matches are geographically local, but it does mean a cross-continent pair's clock
   * similarity is meaningless rather than merely noisy.
   */
  clock: number[] | null;
}

export const emptyTasteProfile: TasteProfile = {
  genres: [],
  popularity: null,
  era: null,
  eraSpread: null,
  discovery: null,
  clock: null,
};

/** Minimum plays before a listening clock says anything. Below this it's noise. */
const MIN_PLAYS_FOR_CLOCK = 8;

/**
 * Per-component scores in 0..1. `null` means "Spotify gave us nothing to compare here",
 * which is distinct from 0.0 ("compared, and you have nothing in common").
 */
export interface VibeBreakdown {
  trackOverlap: number;
  artistOverlap: number;
  genreOverlap: number | null;
  popularitySim: number | null;
  eraSim: number | null;
  discoverySim: number | null;
  clockSim: number | null;
}

/**
 * Base weights, summing to 1.0. Unavailable components are dropped and the rest renormalized,
 * so these are ratios rather than fixed contributions.
 *
 * `eraSim` is deliberately small. It previously renormalized up to 0.23 — and because almost
 * every user's mean release year sits in 2018–2023, it paid out ~0.93 to essentially every
 * pair. That made 22 of a typical score a constant that meant nothing beyond "we both listen
 * to recent music". Two signals that genuinely vary between people replace that weight.
 */
const BASE_WEIGHTS = {
  trackOverlap: 0.25,
  artistOverlap: 0.25,
  genreOverlap: 0.2,
  popularitySim: 0.08,
  eraSim: 0.07,
  discoverySim: 0.09,
  clockSim: 0.06,
} as const;

/** Year gap at which two listeners are considered era-unrelated. */
const ERA_RANGE = 30;

/** Spread gap (in years of stddev) at which two listeners have unrelated era breadth. */
const ERA_SPREAD_RANGE = 12;

/** How much of the era component is mean-vs-spread. Mean still leads. */
const ERA_MEAN_SHARE = 0.65;

/**
 * Compute the vibe score + breakdown between two users.
 */
export function score(
  tracksA: SpotifyTrack[],
  artistsA: SpotifyArtist[],
  profileA: TasteProfile,
  tracksB: SpotifyTrack[],
  artistsB: SpotifyArtist[],
  profileB: TasteProfile
): { score: number; breakdown: VibeBreakdown } {
  const breakdown: VibeBreakdown = {
    trackOverlap: rankWeightedOverlap(
      tracksA.map((t) => t.id),
      tracksB.map((t) => t.id)
    ),
    artistOverlap: rankWeightedOverlap(
      artistsA.map((a) => a.id),
      artistsB.map((a) => a.id)
    ),
    genreOverlap: genreSimilarity(profileA.genres, profileB.genres),
    popularitySim: boundedSimilarity(profileA.popularity, profileB.popularity),
    eraSim: eraSimilarity(profileA, profileB),
    discoverySim: boundedSimilarity(profileA.discovery, profileB.discovery),
    clockSim: clockSimilarity(profileA.clock, profileB.clock),
  };

  // Sum only the components we actually have data for, then renormalize.
  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(BASE_WEIGHTS) as (keyof typeof BASE_WEIGHTS)[]) {
    const value = breakdown[key];
    if (value === null) continue;
    weighted += value * BASE_WEIGHTS[key];
    totalWeight += BASE_WEIGHTS[key];
  }

  // totalWeight is never 0 in practice — track/artist overlap are always computable — but
  // guard anyway rather than emitting NaN.
  const raw = totalWeight === 0 ? 0 : weighted / totalWeight;
  const clamped = Math.max(0, Math.min(100, Math.round(raw * 100)));
  return { score: clamped, breakdown };
}

/**
 * Build a user's TasteProfile from their top tracks and artists.
 *
 * Every field degrades independently: a user whose artists carry no genres still gets a
 * usable era and popularity reading, and vice versa.
 */
export interface TasteInputs {
  /** Short-term top artists (~4 weeks). Paired with `longTermArtists` to read discovery. */
  shortTermArtists?: SpotifyArtist[];
  /** Long-term top artists (years). */
  longTermArtists?: SpotifyArtist[];
  /** Epoch-ms timestamps of recent plays, repeats included. */
  playedAt?: number[];
}

export function buildTasteProfile(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[],
  inputs: TasteInputs = {}
): TasteProfile {
  return {
    genres: buildGenreVector(artists),
    popularity: meanPopularity(tracks, artists),
    era: meanReleaseYear(tracks),
    eraSpread: releaseYearSpread(tracks),
    discovery: discoveryRate(inputs.shortTermArtists, inputs.longTermArtists),
    clock: buildClock(inputs.playedAt),
  };
}

/**
 * How far this month's rotation has drifted from the all-time one.
 *
 * Reuses the rank-weighted overlap: a listener whose short-term and long-term lists agree is
 * stable, one whose lists diverge is exploring. Needs both windows — with only one, there is
 * nothing to compare and the component drops out rather than guessing.
 */
function discoveryRate(
  shortTerm: SpotifyArtist[] | undefined,
  longTerm: SpotifyArtist[] | undefined
): number | null {
  if (!shortTerm?.length || !longTerm?.length) return null;
  const stability = rankWeightedOverlap(
    shortTerm.map((a) => a.id),
    longTerm.map((a) => a.id)
  );
  return clamp01(1 - stability);
}

/** Normalized 24-bin hour-of-day histogram. Null below MIN_PLAYS_FOR_CLOCK plays. */
function buildClock(playedAt: number[] | undefined): number[] | null {
  if (!playedAt || playedAt.length < MIN_PLAYS_FOR_CLOCK) return null;

  const bins = new Array<number>(24).fill(0);
  let counted = 0;
  for (const ts of playedAt) {
    if (!Number.isFinite(ts)) continue;
    const hour = new Date(ts).getUTCHours();
    if (hour < 0 || hour > 23) continue;
    bins[hour] += 1;
    counted += 1;
  }

  if (counted < MIN_PLAYS_FOR_CLOCK) return null;
  return bins.map((n) => n / counted);
}

/** Population standard deviation of release years. Needs 2+ dated tracks to mean anything. */
function releaseYearSpread(tracks: SpotifyTrack[]): number | null {
  const years = tracks
    .map((t) => t.releaseYear)
    .filter((y): y is number => y !== null && Number.isFinite(y));
  if (years.length < 2) return null;

  const mean = years.reduce((s, y) => s + y, 0) / years.length;
  const variance = years.reduce((s, y) => s + (y - mean) ** 2, 0) / years.length;
  return Math.sqrt(variance);
}

/**
 * Which signals Spotify actually returned. Logged at connect time so we can confirm
 * against the live API what this app still has access to.
 */
export function describeSignals(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[],
  profile: TasteProfile
): string {
  const parts = [
    `tracks=${tracks.length}`,
    `artists=${artists.length}`,
    `genres=${profile.genres.length > 0 ? `yes(${profile.genres.length})` : "MISSING"}`,
    `popularity=${profile.popularity !== null ? profile.popularity.toFixed(3) : "MISSING"}`,
    `era=${profile.era !== null ? profile.era.toFixed(1) : "MISSING"}`,
    `eraSpread=${profile.eraSpread !== null ? profile.eraSpread.toFixed(2) : "MISSING"}`,
    `discovery=${profile.discovery !== null ? profile.discovery.toFixed(3) : "MISSING"}`,
    `clock=${profile.clock ? `yes(peak ${peakHour(profile.clock)}h UTC)` : "MISSING"}`,
  ];
  return parts.join(" ");
}

// MARK: - Components

/**
 * Overlap between two ranked lists, discounted by position.
 *
 * Plain Jaccard treats a shared #1 artist the same as a shared #50 — with audio features
 * gone, that lost nuance matters more, so matches are weighted by a log discount on both
 * users' ranks. Normalized against a perfect overlap of the same length, so two identical
 * lists score exactly 1.0 and two disjoint lists score 0.0.
 */
function rankWeightedOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const rankB = new Map<string, number>();
  b.forEach((id, i) => {
    if (!rankB.has(id)) rankB.set(id, i);
  });

  const seen = new Set<string>();
  let shared = 0;
  a.forEach((id, rankA) => {
    if (seen.has(id)) return;
    seen.add(id);
    const rb = rankB.get(id);
    if (rb === undefined) return;
    shared += (positionGain(rankA) + positionGain(rb)) / 2;
  });

  // Ideal = every position of the shorter list matching at the same rank.
  let ideal = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) ideal += positionGain(i);

  if (ideal === 0) return 0;
  return Math.max(0, Math.min(1, shared / ideal));
}

/** DCG-style discount: rank 0 → 1.00, rank 9 → 0.30, rank 49 → 0.18. */
function positionGain(rank: number): number {
  return 1 / Math.log2(rank + 2);
}

/**
 * Cosine similarity between two genre vectors. Returns null when either side has no
 * genre data — Spotify has stopped populating `genres` for some apps, and a zero vector
 * must not be read as "no shared taste".
 */
function genreSimilarity(a: GenreWeight[], b: GenreWeight[]): number | null {
  if (a.length === 0 || b.length === 0) return null;

  const weightB = new Map(b.map((g) => [g.name, g.weight]));
  let dot = 0;
  for (const g of a) {
    const w = weightB.get(g.name);
    if (w !== undefined) dot += g.weight * w;
  }

  const normA = Math.sqrt(a.reduce((s, g) => s + g.weight * g.weight, 0));
  const normB = Math.sqrt(b.reduce((s, g) => s + g.weight * g.weight, 0));
  if (normA === 0 || normB === 0) return null;

  return Math.max(0, Math.min(1, dot / (normA * normB)));
}

/** For bounded 0..1 metrics: similarity is 1 − |Δ|. Null if either side is unknown. */
function boundedSimilarity(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.max(0, Math.min(1, 1 - Math.abs(a - b)));
}

/**
 * Era similarity over both the centre and the breadth of each library.
 *
 * Mean alone was the old behaviour and it conflated "we both like 2010s music" with "we both
 * range across five decades". Spread is folded in as the minority share; when spread is
 * missing on either side the component degrades to mean-only rather than dropping out.
 */
function eraSimilarity(a: TasteProfile, b: TasteProfile): number | null {
  if (a.era === null || b.era === null) return null;

  const meanDiff = Math.min(Math.abs(a.era - b.era), ERA_RANGE);
  const meanSim = 1 - meanDiff / ERA_RANGE;

  if (a.eraSpread === null || b.eraSpread === null) return meanSim;

  const spreadDiff = Math.min(Math.abs(a.eraSpread - b.eraSpread), ERA_SPREAD_RANGE);
  const spreadSim = 1 - spreadDiff / ERA_SPREAD_RANGE;

  return ERA_MEAN_SHARE * meanSim + (1 - ERA_MEAN_SHARE) * spreadSim;
}

/**
 * Similarity between two listening clocks.
 *
 * Compared as deviations from a flat day rather than as raw histograms. Almost everyone
 * listens more in the evening than at 4am, so raw histograms are dominated by that shared
 * shape and every pair looks alike — the same defect that made the old era term useless.
 * Subtracting the uniform baseline leaves only what is distinctive about each person, so two
 * night owls correlate positively while a night owl and an early riser correlate negatively.
 *
 * Negative correlation clamps to 0: genuinely opposite schedules score zero, not less.
 */
function clockSimilarity(a: number[] | null, b: number[] | null): number | null {
  if (!a || !b || a.length !== 24 || b.length !== 24) return null;

  const uniform = 1 / 24;
  const da = a.map((v) => v - uniform);
  const db = b.map((v) => v - uniform);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 24; i++) {
    dot += da[i] * db[i];
    normA += da[i] * da[i];
    normB += db[i] * db[i];
  }

  // A perfectly flat clock has no shape to compare against.
  if (normA === 0 || normB === 0) return null;

  return Math.max(0, Math.min(1, dot / Math.sqrt(normA * normB)));
}

// MARK: - Profile builders

/**
 * Rank-weighted genre vector. An artist at #1 contributes more to your genre identity than
 * one at #40, and an artist tagged with many genres spreads its weight across them rather
 * than dominating. Normalized to sum to 1 so vector length doesn't bias the cosine.
 */
function buildGenreVector(artists: SpotifyArtist[]): GenreWeight[] {
  const totals = new Map<string, number>();

  artists.forEach((artist, rank) => {
    const genres = artist.genres ?? [];
    if (genres.length === 0) return;
    const share = positionGain(rank) / genres.length;
    for (const raw of genres) {
      const name = raw.trim().toLowerCase();
      if (name === "") continue;
      totals.set(name, (totals.get(name) ?? 0) + share);
    }
  });

  if (totals.size === 0) return [];

  const sum = [...totals.values()].reduce((s, w) => s + w, 0);
  if (sum === 0) return [];

  return [...totals.entries()]
    .map(([name, weight]) => ({ name, weight: weight / sum }))
    .sort((x, y) => y.weight - x.weight || x.name.localeCompare(y.name));
}

/**
 * Mean popularity in 0..1, preferring track popularity and falling back to artist
 * popularity. Null when Spotify omits the field on both — which is the case for apps
 * subject to the 2024-11-27 deprecation.
 */
function meanPopularity(
  tracks: SpotifyTrack[],
  artists: SpotifyArtist[]
): number | null {
  const trackPop = tracks
    .map((t) => t.popularity)
    .filter((p): p is number => p !== null && Number.isFinite(p));
  if (trackPop.length > 0) {
    return clamp01(trackPop.reduce((s, p) => s + p, 0) / trackPop.length / 100);
  }

  const artistPop = artists
    .map((a) => a.popularity)
    .filter((p): p is number => p !== null && Number.isFinite(p));
  if (artistPop.length > 0) {
    return clamp01(artistPop.reduce((s, p) => s + p, 0) / artistPop.length / 100);
  }

  return null;
}

/** Mean (possibly fractional) release year across tracks that have one. */
export function meanReleaseYear(tracks: SpotifyTrack[]): number | null {
  const years = tracks
    .map((t) => t.releaseYear)
    .filter((y): y is number => y !== null && Number.isFinite(y));
  if (years.length === 0) return null;
  return years.reduce((s, y) => s + y, 0) / years.length;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Busiest hour in a clock histogram — for logging only. */
function peakHour(clock: number[]): number {
  let best = 0;
  for (let i = 1; i < clock.length; i++) {
    if (clock[i] > clock[best]) best = i;
  }
  return best;
}
