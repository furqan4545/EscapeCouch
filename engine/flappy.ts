// Flappy push-up core: the bird's height is the player's head height, pipes scroll in from the
// right, and each pipe's gap is fitted to where the head actually was when that pipe arrived,
// so a recorded set always reads as a clean run. Every `levelEvery` pipes the level goes up and
// the next row of the level table takes over: faster scroll, pipes closer together, tighter gaps.
// Pure functions; the phone can drive the same state live by feeding frames as they come.

import { LM, type PoseFrame } from "./types";

/** One difficulty level, in on-screen units of the finished video (what the viewer sees). */
export interface LevelSpec {
  /** Scroll speed, px per second of the finished video. */
  pxPerSec: number;
  /** Distance between consecutive pipes, centre to centre, px. */
  distance: number;
  /** Smallest vertical opening, px. Grows when the head moves a lot while the pipe slides past. */
  gap: number;
}

// Reference measured frame by frame on 23 Sep (research/evidence/gamified-reference/reference.mp4,
// 30 fps, scaled to 1080x1920): constant 900 px/s for all 48 s, pipes 450 px apart (one every
// 0.50 s), body 129 px wide, gap median 438 px. Level 1 is the owner-approved slow opener, level 2
// is the reference exactly, levels 3-5 go past it; beyond the table the last row repeats.
export const DEFAULT_LEVELS: LevelSpec[] = [
  { pxPerSec: 570, distance: 646, gap: 370 },
  { pxPerSec: 900, distance: 450, gap: 360 },
  { pxPerSec: 1000, distance: 420, gap: 340 },
  { pxPerSec: 1100, distance: 400, gap: 320 },
  { pxPerSec: 1200, distance: 380, gap: 300 },
];

export interface FlappyOptions {
  width: number;
  height: number;
  /** Bird centre as a fraction of the width. */
  birdX: number;
  /** Amplifies head movement around its mean, 1 = one to one. */
  gain: number;
  /** Exponential smoothing on the head height, 0..1 (1 = none). */
  smoothing: number;
  /** Pipe body width, px. The reference's is 129. */
  pipeWidth: number;
  /** Seconds of the finished video before the first pipe reaches the bird. */
  firstPassSec: number;
  /** Pipes per level. */
  levelEvery: number;
  levels: LevelSpec[];
  /** Clip seconds per second of the finished video (the render's playback speed). Converts the on-screen level table to clip time. */
  playback: number;
  /** No level-up in the last this-many seconds of the video: the run ends on the level it was on (owner, 23 Sep: "dont jump to level 5"). */
  endLevelGuardSec: number;
}

export const DEFAULT_FLAPPY: FlappyOptions = {
  width: 1080,
  height: 1920,
  birdX: 0.22,
  gain: 1.15,
  smoothing: 0.35,
  pipeWidth: 132,
  firstPassSec: 1,
  levelEvery: 15,
  levels: DEFAULT_LEVELS,
  playback: 1,
  endLevelGuardSec: 1.5,
};

export interface BirdSample {
  t: number;
  /** Bird centre y, px. */
  y: number;
  /** Nose x and y in px (unsmoothed), for effects that centre on the face. */
  faceX: number;
  faceY: number;
  /** Vertical speed, px per second (positive = falling). Drives the tilt. */
  vy: number;
  tracked: boolean;
}

export interface Pipe {
  k: number;
  /** Second (source clip time) when the pipe's centre crosses the bird's centre. */
  passT: number;
  gapTop: number;
  gapBottom: number;
  /** Level the player is on while this pipe approaches (1-based). */
  level: number;
  /** Scroll distance travelled by the world at passT, px. Makes positions continuous across level changes. */
  dist: number;
}

/**
 * ELO per lap. A lap = one level (levelEvery pipes). Owner, 23 Sep: "ELO only increases 1 per lap,
 * but after 5 laps it increases like 3."
 */
export interface EloRule {
  perLap: number;
  boostAfterLaps: number;
  boostPerLap: number;
}
export const DEFAULT_ELO: EloRule = { perLap: 1, boostAfterLaps: 5, boostPerLap: 3 };
/** ELO for completing lap number `lap` (1-based). */
export const lapElo = (lap: number, r: EloRule = DEFAULT_ELO) => (lap <= r.boostAfterLaps ? r.perLap : r.boostPerLap);
/** Total ELO gained after `laps` completed laps. */
export const eloGain = (laps: number, r: EloRule = DEFAULT_ELO) => Math.min(laps, r.boostAfterLaps) * r.perLap + Math.max(0, laps - r.boostAfterLaps) * r.boostPerLap;

/** Level (1-based) for a given score. */
export const levelAt = (score: number, o: FlappyOptions = DEFAULT_FLAPPY) => 1 + Math.floor(score / o.levelEvery);
export const levelSpec = (level: number, o: FlappyOptions = DEFAULT_FLAPPY): LevelSpec => o.levels[Math.min(o.levels.length, Math.max(1, level)) - 1];
/** Scroll speed in px per CLIP second (the engine's time base). */
export const speedAt = (level: number, o: FlappyOptions = DEFAULT_FLAPPY) => levelSpec(level, o).pxPerSec / o.playback;
/** Clip seconds between consecutive pipes. */
export const spacingAt = (level: number, o: FlappyOptions = DEFAULT_FLAPPY) => (levelSpec(level, o).distance / levelSpec(level, o).pxPerSec) * o.playback;
export const gapAt = (level: number, o: FlappyOptions = DEFAULT_FLAPPY) => levelSpec(level, o).gap;

/** Head-height track for the clip window, one sample per source frame in [startT, endT]. */
export function birdTrack(frames: PoseFrame[], startT: number, endT: number, o: FlappyOptions = DEFAULT_FLAPPY): BirdSample[] {
  const win = frames.filter((f) => f.t >= startT && f.t <= endT);
  const raw: (number | null)[] = win.map((f) => (f.ok && f.lm ? f.lm[LM.NOSE][1] : null));
  const seen = raw.filter((v): v is number => v !== null);
  const mean = seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : 0.5;
  const out: BirdSample[] = [];
  let s: number | null = null;
  let prevY = 0;
  let faceX = o.width / 2, faceY = o.height / 2;
  for (let k = 0; k < win.length; k++) {
    const v = raw[k];
    if (v !== null) s = s === null ? v : s + o.smoothing * (v - s);
    const lm = win[k].ok && win[k].lm ? win[k].lm! : null;
    if (lm) { faceX = lm[LM.NOSE][0] * o.width; faceY = lm[LM.NOSE][1] * o.height; }
    const norm = Math.max(0.08, Math.min(0.92, mean + o.gain * ((s ?? mean) - mean)));
    const y = norm * o.height;
    const dt = k ? win[k].t - win[k - 1].t : 1 / 30;
    const vy = k ? (y - prevY) / dt : 0;
    prevY = y;
    out.push({ t: win[k].t, y: Math.round(y), faceX: Math.round(faceX), faceY: Math.round(faceY), vy: Math.round(vy), tracked: v !== null });
  }
  return out;
}

export interface RepLike {
  t: number;
  durationSec: number;
}

/**
 * The moment the player gives up: the knees come down and no push-up starts again. From a floor
 * camera facing the player the knees are hidden behind the arms in a plank, and BlazePose's knee
 * visibility jumps when they drop. The model also reports "visible" knees mid-set now and then
 * (take1: 21.0 s, clearly a plank on video), so a knees-down moment only counts once the last rep's
 * descent has started. Returns clip seconds, or null if the knees never come down.
 */
export function giveUpAt(frames: PoseFrame[], reps: RepLike[], on = 0.5, hold = 0.45, holdSec = 1): number | null {
  const kv = (f: PoseFrame) => (f.ok && f.lm ? (f.lm[LM.L_KNEE][3] + f.lm[LM.R_KNEE][3]) / 2 : 0);
  const lastDescent = reps.length ? Math.max(...reps.map((r) => r.t - r.durationSec)) : -Infinity;
  const fps = frames.length > 1 ? 1 / (frames[1].t - frames[0].t) : 30;
  const holdFrames = Math.max(1, Math.round(holdSec * fps));
  for (let i = 0; i + holdFrames <= frames.length; i++) {
    if (frames[i].t <= lastDescent || kv(frames[i]) < on) continue;
    if (frames.slice(i, i + holdFrames).every((g) => kv(g) >= hold)) return frames[i].t;
  }
  return null;
}

/**
 * Pipes through the window. Pipe k arrives spacingAt(level) after pipe k-1, where the level is the
 * one the player is on after passing k-1 pipes. Its gap is centred on the head's height as it
 * arrives, widened by how far the head moves while the pipe slides past.
 */
export function fitPipes(track: BirdSample[], startT: number, endT: number, o: FlappyOptions = DEFAULT_FLAPPY): Pipe[] {
  const pipes: Pipe[] = [];
  const yAt = (t: number) => {
    let best = track[0];
    for (const s of track) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
    return best.y;
  };
  const firstClipSec = o.firstPassSec * o.playback;
  let passT = startT + firstClipSec;
  let dist = speedAt(1, o) * firstClipSec;
  for (let k = 0; passT < endT - 0.5; k++) {
    // The pipe that would complete a level never lands in the last endLevelGuardSec of the video.
    if ((k + 1) % o.levelEvery === 0 && passT > endT - o.endLevelGuardSec * o.playback) break;
    const level = levelAt(k, o);
    const crossSec = (o.pipeWidth + 110) / speedAt(level, o);
    const ys = [-0.5, -0.25, 0, 0.25, 0.5].map((f) => yAt(passT + f * crossSec));
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const centre = (lo + hi) / 2;
    const gap = Math.max(gapAt(level, o), hi - lo + 210);
    const gapTop = Math.max(90, Math.min(o.height - 90 - gap, centre - gap / 2));
    pipes.push({ k, passT: Math.round(passT * 100) / 100, gapTop: Math.round(gapTop), gapBottom: Math.round(gapTop + gap), level, dist: Math.round(dist) });
    const nextLevel = levelAt(k + 1, o);
    const gapSec = spacingAt(nextLevel, o);
    passT += gapSec;
    dist += speedAt(nextLevel, o) * gapSec;
  }
  return pipes;
}

/** World scroll distance at clip time t, px: piecewise linear between pipe passes at each level's speed. */
export function distAt(pipes: Pipe[], t: number, o: FlappyOptions = DEFAULT_FLAPPY): number {
  if (!pipes.length) return speedAt(1, o) * t;
  const first = pipes[0];
  if (t <= first.passT) return first.dist - (first.passT - t) * speedAt(1, o);
  for (let k = 0; k < pipes.length - 1; k++) {
    const a = pipes[k], b = pipes[k + 1];
    if (t <= b.passT) return a.dist + ((t - a.passT) / (b.passT - a.passT)) * (b.dist - a.dist);
  }
  const last = pipes[pipes.length - 1];
  return last.dist + (t - last.passT) * speedAt(levelAt(pipes.length, o), o);
}

/** Left edge of a pipe at clip time t, px. */
export function pipeLeft(p: Pipe, t: number, pipes: Pipe[], o: FlappyOptions = DEFAULT_FLAPPY): number {
  return o.birdX * o.width + (p.dist - distAt(pipes, t, o)) - o.pipeWidth / 2;
}

export function scoreAt(pipes: Pipe[], t: number): number {
  return pipes.filter((p) => p.passT <= t).length;
}

/** Tilt in degrees from vertical speed: nose up when rising, dives when falling. */
export function tiltDeg(vy: number): number {
  return Math.max(-28, Math.min(70, vy / 14));
}
