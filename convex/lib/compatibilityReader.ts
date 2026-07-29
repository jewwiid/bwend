/**
 * CompatibilityReader — turns a VibeBreakdown + shared artist names into a 1–2 sentence
 * qualitative read of the compatibility.
 *
 * Rules-based (no AI): read each breakdown component, pick the strongest and weakest signals,
 * map them to short copy fragments, and stitch them together.
 *
 * Components whose value is null were never computed — Spotify withheld the underlying
 * signal — so they are skipped entirely rather than being read as "you have nothing in
 * common here". The energy/mood/tempo reads are gone with /audio-features; genre and
 * popularity replace them.
 */

import type { VibeBreakdown } from "./vibeScore";

const STRONG = 0.75;
const WEAK = 0.40;

type Kind = "artist" | "track" | "genre" | "popularity" | "era" | "discovery" | "clock";

interface Component {
  value: number;
  kind: Kind;
}

export function readCompatibility(
  breakdown: VibeBreakdown,
  sharedArtistNames: string[]
): string {
  // Order matters: on ties the earlier component wins, so the most concrete signals
  // (actual shared artists and tracks) lead ahead of the abstract ones.
  const candidates: { value: number | null; kind: Kind }[] = [
    { value: breakdown.artistOverlap, kind: "artist" },
    { value: breakdown.trackOverlap, kind: "track" },
    { value: breakdown.genreOverlap, kind: "genre" },
    { value: breakdown.popularitySim, kind: "popularity" },
    { value: breakdown.eraSim, kind: "era" },
    { value: breakdown.discoverySim, kind: "discovery" },
    { value: breakdown.clockSim, kind: "clock" },
  ];

  const components: Component[] = candidates
    .filter((c): c is Component => c.value !== null);

  // Nothing was computable — shouldn't happen (overlap is always available) but the copy
  // still needs to say something.
  if (components.length === 0) {
    return "There's a quiet pull between your libraries.";
  }

  let strongest = components[0];
  for (const c of components) {
    if (c.value > strongest.value) strongest = c;
  }
  let weakest = components[0];
  for (const c of components) {
    if (c.value < weakest.value) weakest = c;
  }

  const fragments: string[] = [];

  // Lead with the strongest signal.
  if (strongest.value >= STRONG) {
    fragments.push(strongPhrase(strongest.kind));
  } else if (strongest.value >= 0.6) {
    fragments.push(warmPhrase(strongest.kind));
  } else {
    fragments.push("There's a quiet pull between your libraries.");
  }

  // Then name the weakest signal if it's genuinely divergent.
  if (weakest.value < WEAK && weakest.kind !== strongest.kind) {
    fragments.push(divergencePhrase(weakest.kind));
  }

  // Anchor with a shared artist if there is one.
  if (sharedArtistNames.length > 0) {
    const first = sharedArtistNames[0];
    if (fragments.length >= 2) {
      // Replace the second fragment with the artist anchor.
      fragments[1] = `And you both keep coming back to ${first}.`;
    } else {
      fragments.push(`You both keep coming back to ${first}.`);
    }
  }

  return fragments.join(" ");
}

function strongPhrase(kind: Kind): string {
  switch (kind) {
    case "artist":
      return "You orbit the same artists.";
    case "track":
      return "You reach for the same songs.";
    case "genre":
      return "You live in the same corner of music.";
    case "popularity":
      return "You dig at exactly the same depth.";
    case "era":
      return "You're rooted in the same moment in time.";
    case "discovery":
      return "You chase new music at exactly the same pace.";
    case "clock":
      return "You listen at the same hours.";
  }
}

function warmPhrase(kind: Kind): string {
  switch (kind) {
    case "artist":
      return "Your artists overlap more than most.";
    case "track":
      return "You've found some of the same songs.";
    case "genre":
      return "Your genres keep drifting toward each other.";
    case "popularity":
      return "You wander off the beaten path by about the same amount.";
    case "era":
      return "Your eras are within reach of each other.";
    case "discovery":
      return "You're restless about new music in similar ways.";
    case "clock":
      return "Your days seem to run on a similar clock.";
  }
}

function divergencePhrase(kind: Kind): string {
  switch (kind) {
    case "artist":
      return "Though your artists barely cross.";
    case "track":
      return "Even if your tracklists mostly don't overlap.";
    case "genre":
      return "Though you're pulled toward different sounds.";
    case "popularity":
      return "Though one of you is deep in the crates while the other rides the charts.";
    case "era":
      return "But your eras diverge — one of you is somewhere else in time.";
    case "discovery":
      return "Though one of you is always hunting and the other stays loyal.";
    case "clock":
      return "Though one of you is up long after the other's asleep.";
  }
}
