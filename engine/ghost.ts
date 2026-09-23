import type { Ghost, RepEvent } from "./types";

/** A ghost made from a real take: someone's rep events, re-based to match-clock seconds. */
export function ghostFromReps(reps: RepEvent[], name: string, elo: number, startT = 0): Ghost {
  return { name, elo, source: "recorded", repTimes: reps.map((r) => Math.round((r.t - startT) * 100) / 100).filter((t) => t >= 0) };
}

export type Pacing = "steady" | "fast-start" | "late-surge" | "gas-out";

export interface AuthoredGhostOptions {
  name: string;
  elo: number;
  totalReps: number;
  durationSec: number;
  pacing?: Pacing;
  /** Same seed, same ghost. */
  seed?: number;
  /** Random timing wobble per rep as a fraction of the mean gap, 0..1. */
  jitter?: number;
}

/**
 * A ghost with no footage behind it. The pacing curve decides where in the match the reps land;
 * jitter keeps the bar from moving like a metronome. Deterministic for a given seed so a render
 * can be reproduced.
 */
export function authoredGhost(o: AuthoredGhostOptions): Ghost {
  const rand = mulberry32(o.seed ?? 1);
  const pacing = o.pacing ?? "steady";
  const jitter = o.jitter ?? 0.25;
  const times: number[] = [];
  for (let k = 0; k < o.totalReps; k++) {
    const u = (k + 0.5) / o.totalReps; // 0..1 progress through the rep count
    let frac: number;
    switch (pacing) {
      case "fast-start":
        frac = Math.pow(u, 1.6); // many reps early, gaps widen
        break;
      case "late-surge":
        frac = Math.pow(u, 0.65); // slow open, reps bunch at the end
        break;
      case "gas-out":
        frac = u < 0.6 ? u * 0.55 : 0.33 + Math.pow((u - 0.6) / 0.4, 2.2) * 0.67; // strong, then a wall
        break;
      default:
        frac = u;
    }
    const meanGap = o.durationSec / o.totalReps;
    const wobble = (rand() - 0.5) * 2 * jitter * meanGap;
    times.push(Math.max(0.3, Math.min(o.durationSec - 0.2, frac * o.durationSec + wobble)));
  }
  times.sort((a, b) => a - b);
  return { name: o.name, elo: o.elo, source: "authored", repTimes: times.map((t) => Math.round(t * 100) / 100) };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
