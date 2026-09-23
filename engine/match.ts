import type { FrameState, MatchConfig, MatchFrame, MatchResult, RepEvent } from "./types";

/** How many reps of lead it takes to pin the bar to one side. */
const BAR_FULL_LEAD = 6;
/** Seconds of "3, 2, 1" before the clock runs. */
export const COUNTDOWN_SEC = 3;

/**
 * Replays your rep events against a ghost's rep timeline on a shared match clock and emits one
 * state per source frame. Pure: the HUD renders from these frames, the app fills them live.
 */
export function simulateMatch(states: FrameState[], reps: RepEvent[], cfg: MatchConfig): MatchResult {
  const yourTimes = reps.map((r) => r.t - cfg.startT).filter((t) => t >= 0 && t <= cfg.durationSec);
  const ghostTimes = cfg.ghost.repTimes.filter((t) => t >= 0 && t <= cfg.durationSec);
  const frames: MatchFrame[] = [];
  for (const s of states) {
    const clock = s.t - cfg.startT;
    const status: MatchFrame["status"] = clock < 0 ? "countdown" : clock > cfg.durationSec ? "over" : "live";
    const yourReps = yourTimes.filter((t) => t <= clock).length;
    const ghostReps = ghostTimes.filter((t) => t <= clock).length;
    const bar = Math.max(-1, Math.min(1, (yourReps - ghostReps) / BAR_FULL_LEAD));
    frames.push({ i: s.i, t: s.t, clock: round2(clock), timeLeft: Math.max(0, round2(cfg.durationSec - clock)), yourReps, ghostReps, bar: round2(bar), depth: s.depth, phase: s.phase, status });
  }
  const yourTotal = yourTimes.length;
  const ghostTotal = ghostTimes.length;
  return { yourReps: yourTotal, ghostReps: ghostTotal, winner: yourTotal > ghostTotal ? "you" : yourTotal < ghostTotal ? "ghost" : "draw", frames };
}

/** First rep minus a lead-in, so the clock starts just before the set does. */
export function suggestStart(reps: RepEvent[], leadInSec = 1.5): number {
  return reps.length ? Math.max(0, reps[0].t - leadInSec) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
