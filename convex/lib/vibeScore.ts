/**
 * VibeScoreEngine — ported verbatim from Swift VibeScoreEngine.swift.
 *
 * Pure functions, zero I/O. Must produce byte-identical scores to the Swift version.
 *
 * Weights (sum = 1.0):
 *   track overlap    · 0.25
 *   artist overlap   · 0.25
 *   energy similarity· 0.15
 *   valence sim      · 0.15
 *   tempo sim        · 0.10
 *   era sim          · 0.10
 */

export interface SpotifyTrack {
  id: string;
  name: string;
  artistIds: string[];
  releaseYear: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
}

export interface SpotifyAudioFeatures {
  id: string;
  energy: number;
  valence: number;
  tempo: number;
  danceability: number;
}

export interface AudioProfile {
  energy: number;
  valence: number;
  tempo: number;
  danceability: number;
  era: number;
}

export const emptyAudioProfile: AudioProfile = {
  energy: 0,
  valence: 0,
  tempo: 0,
  danceability: 0,
  era: 0,
};

export interface VibeBreakdown {
  trackOverlap: number;
  artistOverlap: number;
  energySim: number;
  valenceSim: number;
  tempoSim: number;
  eraSim: number;
}

const WEIGHTS = {
  trackOverlap: 0.25,
  artistOverlap: 0.25,
  energySim: 0.15,
  valenceSim: 0.15,
  tempoSim: 0.10,
  eraSim: 0.10,
} as const;

const TEMPO_RANGE = 140; // normalize BPM diffs (60–200 range), clamp to [0,140]
const ERA_RANGE = 30; // normalize year diffs, clamp to [0,30]

/**
 * Compute the vibe score + breakdown between two users.
 * Ported verbatim from VibeScoreEngine.score().
 */
export function score(
  tracksA: SpotifyTrack[],
  artistsA: SpotifyArtist[],
  audioA: AudioProfile,
  tracksB: SpotifyTrack[],
  artistsB: SpotifyArtist[],
  audioB: AudioProfile
): { score: number; breakdown: VibeBreakdown } {
  const trackOverlap = jaccard(
    new Set(tracksA.map((t) => t.id)),
    new Set(tracksB.map((t) => t.id))
  );
  const artistOverlap = jaccard(
    new Set(artistsA.map((a) => a.id)),
    new Set(artistsB.map((a) => a.id))
  );

  const energySim = similarity(audioA.energy, audioB.energy);
  const valenceSim = similarity(audioA.valence, audioB.valence);

  // Tempo: clamp absolute BPM difference to [0, TEMPO_RANGE] then scale to [0,1].
  const tempoDiff = Math.min(Math.abs(audioA.tempo - audioB.tempo), TEMPO_RANGE);
  const tempoSim = 1.0 - tempoDiff / TEMPO_RANGE;

  // Era: same idea with year differences.
  const eraDiff = Math.min(Math.abs(audioA.era - audioB.era), ERA_RANGE);
  const eraSim = 1.0 - eraDiff / ERA_RANGE;

  const breakdown: VibeBreakdown = {
    trackOverlap,
    artistOverlap,
    energySim,
    valenceSim,
    tempoSim,
    eraSim,
  };

  const raw =
    trackOverlap * WEIGHTS.trackOverlap +
    artistOverlap * WEIGHTS.artistOverlap +
    energySim * WEIGHTS.energySim +
    valenceSim * WEIGHTS.valenceSim +
    tempoSim * WEIGHTS.tempoSim +
    eraSim * WEIGHTS.eraSim;

  // Floor at 0, ceil at 100, round.
  const clamped = Math.max(0, Math.min(100, Math.round(raw * 100)));
  return { score: clamped, breakdown };
}

/**
 * Aggregate per-track audio features into a single AudioProfile for a user.
 * Used at onboarding time, before we ever call score().
 *
 * Ported verbatim from VibeScoreEngine.aggregateAudioProfile().
 * Note: era is averaged over ALL tracks (with releaseYear), while energy/valence/tempo/
 * danceability are averaged only over tracks that HAVE audio features. Different denominators.
 */
export function aggregateAudioProfile(
  tracks: SpotifyTrack[],
  features: SpotifyAudioFeatures[]
): AudioProfile {
  if (features.length === 0) return { ...emptyAudioProfile };

  const featureByTrack = new Map(features.map((f) => [f.id, f]));

  // Only aggregate over tracks we actually have features for.
  const known = tracks.filter((t) => featureByTrack.has(t.id));
  if (known.length === 0) return { ...emptyAudioProfile };

  const count = known.length;
  const energy = known.reduce((sum, t) => sum + featureByTrack.get(t.id)!.energy, 0) / count;
  const valence = known.reduce((sum, t) => sum + featureByTrack.get(t.id)!.valence, 0) / count;
  const tempo = known.reduce((sum, t) => sum + featureByTrack.get(t.id)!.tempo, 0) / count;
  const danceability =
    known.reduce((sum, t) => sum + featureByTrack.get(t.id)!.danceability, 0) / count;

  // Era: average release year across tracks (year can be fractional if release date has month precision).
  const years = tracks.map((t) => t.releaseYear).filter((y): y is number => y !== null);
  const era = years.length === 0 ? 0 : years.reduce((sum, y) => sum + y, 0) / years.length;

  return { energy, valence, tempo, danceability, era };
}

// MARK: - Math helpers

/**
 * Jaccard similarity between two sets: |∩| / |∪|.
 * Returns 0 when both are empty (defined as "no shared ground" rather than NaN).
 */
function jaccard<T>(a: Set<T>, b: Set<T>): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersectionCount = 0;
  for (const item of a) {
    if (b.has(item)) intersectionCount++;
  }
  return intersectionCount / union.size;
}

/**
 * For bounded 0..1 metrics (energy, valence, danceability): similarity is 1 − |Δ|.
 */
function similarity(a: number, b: number): number {
  return 1.0 - Math.abs(a - b);
}
