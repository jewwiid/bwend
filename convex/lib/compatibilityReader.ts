/**
 * CompatibilityReader — ported verbatim from Swift CompatibilityReader.swift.
 *
 * Pure function that turns a VibeBreakdown + shared artist names into a 1–2 sentence
 * qualitative read of the compatibility.
 *
 * Rules-based (no AI): read each breakdown component, pick the strongest and weakest signals,
 * map them to short copy fragments, and stitch them together.
 */

import type { VibeBreakdown } from "./vibeScore";

const STRONG = 0.75;
const WEAK = 0.40;

type Kind = "energy" | "artist" | "track" | "mood" | "tempo" | "era";

interface Component {
  label: string;
  value: number;
  kind: Kind;
}

export function readCompatibility(
  breakdown: VibeBreakdown,
  sharedArtistNames: string[]
): string {
  const components: Component[] = [
    { label: "energy", value: breakdown.energySim, kind: "energy" },
    { label: "artist", value: breakdown.artistOverlap, kind: "artist" },
    { label: "track", value: breakdown.trackOverlap, kind: "track" },
    { label: "mood", value: breakdown.valenceSim, kind: "mood" },
    { label: "tempo", value: breakdown.tempoSim, kind: "tempo" },
    { label: "era", value: breakdown.eraSim, kind: "era" },
  ];

  // Pick the strongest and weakest. On ties, Swift's max(by:) returns the FIRST maximal element;
  // we replicate by using >= in the comparator so the earlier component wins.
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
    case "energy":
      return "Your energy is perfectly synced.";
    case "artist":
      return "You orbit the same artists.";
    case "track":
      return "You reach for the same songs.";
    case "mood":
      return "You feel music the same way.";
    case "tempo":
      return "Your pulse lives at the same BPM.";
    case "era":
      return "You're rooted in the same moment in time.";
  }
}

function warmPhrase(kind: Kind): string {
  switch (kind) {
    case "energy":
      return "Your energy levels track close.";
    case "artist":
      return "Your artists overlap more than most.";
    case "track":
      return "You've found some of the same songs.";
    case "mood":
      return "Your emotional range rhymes.";
    case "tempo":
      return "Your tempos sit in the same neighbourhood.";
    case "era":
      return "Your eras are within reach of each other.";
  }
}

function divergencePhrase(kind: Kind): string {
  switch (kind) {
    case "energy":
      return "But your energy levels pull in different directions.";
    case "artist":
      return "Though your artists barely cross.";
    case "track":
      return "Even if your tracklists mostly don't overlap.";
    case "mood":
      return "Though you feel music on different emotional registers.";
    case "tempo":
      return "But you live at different tempos.";
    case "era":
      return "But your eras diverge — one of you is somewhere else in time.";
  }
}
