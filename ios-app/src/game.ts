// Live game state. Rules come from the shared engine (level table, ELO per lap, rep counting,
// give-up); this file only adds what a live game needs: the bird centred on the player's body,
// pipes generated ahead of it, hits and lives. A run ends on the timer (a win), STOP, giving up
// (knees down), or the bird dying when its last life is hit (owner, 23 Sep: "we had life in each section").

import { DEFAULT_FLAPPY, eloGain, gapAt, giveUpAt, levelAt, levelSpec, speedAt, tiltDeg, type EloRule, type FlappyOptions } from '../../engine/flappy';
import { RepDetector } from '../../engine/reps';
import { LM, type Landmark, type PoseFrame } from '../../engine/types';

/** Pipes move at the video's on-screen speeds (level 1 = 570 px/s, level 5 = 1200) in every difficulty (owner, 23 Sep: fast even for beginners). */
export const LIVE: FlappyOptions = { ...DEFAULT_FLAPPY, playback: 1 };
export const WORLD_W = 1080;
/** Everyone starts here (owner, 23 Sep). */
export const START_ELO = 100;

/**
 * App ELO per lap (a lap = one level = 15 pipes): the video's rule (DEFAULT_ELO: +1, +3 after 5
 * laps) scaled x10 so ranks move when starting from 100. My choice, to tune with the owner.
 */
export const APP_ELO: EloRule = { perLap: 10, boostAfterLaps: 5, boostPerLap: 30 };

/** Difficulty picked on the first screen. Speed is the same for all; easier modes space the pipes out. */
export interface Mode {
  name: string;
  blurb: string;
  startLevel: number;
  /** Pipe hits the bird survives; the last one kills it. */
  lives: number;
  /** Multiplies the level table's distance between pipes. */
  distanceScale: number;
}
export const MODES: Mode[] = [
  { name: 'Noodle Arms', blurb: 'Full speed, pipes far apart, 5 lives', startLevel: 1, lives: 5, distanceScale: 1.8 },
  { name: 'Gym Rat', blurb: 'Full speed, a bit more room, 3 lives', startLevel: 1, lives: 3, distanceScale: 1.35 },
  { name: 'Protein Shake Addict', blurb: 'Starts at level 2, tight pipes, 3 lives', startLevel: 2, lives: 3, distanceScale: 1 },
  { name: 'Built Different', blurb: 'Starts at level 3, tight pipes, one life', startLevel: 3, lives: 1, distanceScale: 1 },
];
/** Seconds the bird tumbles after its last life before the results (the video ends on the death). */
export const DEATH_SEC = 1.2;
export const BIRD_W = 168;
export const BIRD_X = LIVE.birdX * WORLD_W;
/** Hitbox radius, a little smaller than the drawn bird so grazes don't count. */
const BIRD_R = 48;
const CAP_OVER = 13;
/**
 * Calibrated movement (owner, 23 Sep): during the last second of the get-ready countdown the player
 * holds plank; that fixes the plank height and the shoulder width (how far they are from the camera).
 * Then body movement is measured in shoulder widths, so it is the same near or far (a fixed gain
 * slammed the bird edge to edge when the owner stood close: 881 -> 183 px in half a second).
 * take1: plank shoulders at 0.320 of the image height, bottom of a push-up at 0.482, which is 0.7
 * shoulder widths lower. Plank puts the bird at the top of the gap band, a full push-up at the bottom.
 */
export const PUSHUP_TRAVEL = 0.7;
/** Gap band, as fractions of the screen height: top = plank, bottom = a full push-up at level 1 (deeper at higher levels). */
export const BAND_TOP = 0.275;
const BAND_BOTTOM = 0.725;
/** Seconds of plank at the end of the countdown that the calibration averages. */
const CALIBRATE_SEC = 1;
/** The drawn bird eases toward the tracked height (seconds), so it glides at 60 fps between 30 fps camera frames. */
const BIRD_EASE_SEC = 0.04;
/**
 * Give-up, live (take1, 23 Sep): mid-set knee false alarms peaked at 0.69 visibility and lasted up
 * to 3.0 s; the real give-up peaked at 0.88 and lasted 8.2 s. So: knees must reach 0.75, then stay
 * above 0.45 for 3 s. The video renderer can use 0.5 / 1 s because it knows no rep follows.
 */
const GIVE_UP = { on: 0.75, hold: 0.45, sec: 3 };

export type Phase = 'home' | 'ready' | 'play' | 'dying' | 'over';
export type EndReason = 'gave up' | 'stopped' | 'time up' | 'died';
/** Get-ready countdown choices on the menu, seconds (owner: 5 by default, adjustable). */
export const COUNTDOWNS = [3, 5, 10, 15];
export type Sfx = 'levelup.wav' | 'boom.wav';

export interface Pipe {
  k: number;
  x: number;
  gapTop: number;
  gapBottom: number;
  passed: boolean;
  hit: boolean;
}

export interface Game {
  /** Changes once per run; the results screen is keyed on it. */
  id: number;
  phase: Phase;
  mode: Mode;
  /** Profile ELO when the run started. */
  startElo: number;
  /** Run length picked on the first screen, seconds. */
  durationSec: number;
  worldH: number;
  /** Seconds since the run started. */
  t: number;
  birdY: number;
  /** Where the body says the bird should be; birdY eases toward it every frame. */
  birdTarget: number;
  birdVy: number;
  /** Get-ready countdown length, seconds. */
  countdownSec: number;
  /** Plank height (world px) and shoulder width (world px) from the end of the countdown. */
  calib: { plankY: number; span: number } | null;
  /** Body height and shoulder width over the last second, for the calibration. */
  calibSamples: { t: number; y: number; span: number }[];
  tracked: boolean;
  /** Seconds since the get-ready countdown started. */
  readyT: number;
  /** Where the last gap sat in the (stretched) body range, 0 = top, 1 = bottom. */
  lastGap: number;
  pipes: Pipe[];
  nextK: number;
  score: number;
  /** Pipes hit this run. A hit costs the pipe's point and a life. */
  hits: number;
  lives: number;
  /** Run time the bird died (phase 'dying'). */
  diedAt: number;
  reps: number;
  passAt: number;
  levelUpAt: number;
  hitAt: number;
  endReason: EndReason | null;
  /** Seconds recorded after the moment the player actually gave up (the give-up hold); trimmed off the video. */
  cutBackSec: number;
  /** Camera time the pipes started, for the give-up check. */
  startCamT: number;
  smoothed: number | null;
  lastCamT: number;
  frames: PoseFrame[];
  frameI: number;
  detector: RepDetector;
}

let runs = 0;

export function newGame(worldH: number, phase: Phase, mode: Mode, durationSec: number, startElo: number, countdownSec = 5): Game {
  return {
    id: ++runs,
    startElo,
    phase,
    mode,
    durationSec,
    worldH,
    t: 0,
    birdY: worldH * 0.5,
    birdTarget: worldH * 0.5,
    birdVy: 0,
    countdownSec,
    calib: null,
    calibSamples: [],
    tracked: false,
    readyT: 0,
    lastGap: 0.5,
    pipes: [],
    nextK: 0,
    score: 0,
    hits: 0,
    lives: mode.lives,
    diedAt: 0,
    reps: 0,
    passAt: -9,
    levelUpAt: -9,
    hitAt: -9,
    endReason: null,
    cutBackSec: 0,
    startCamT: 0,
    smoothed: null,
    lastCamT: 0,
    frames: [],
    frameI: 0,
    detector: new RepDetector(),
  };
}

/** Laps (levels) completed in this run: 15 pipes each. ELO is earned per lap. */
export const laps = (g: Game) => levelAt(g.score, LIVE) - 1;
export const level = (g: Game) => laps(g) + g.mode.startLevel;
export const eloNow = (g: Game) => g.startElo + eloGain(laps(g), APP_ELO);
export const timeLeft = (g: Game) => Math.max(0, g.durationSec - g.t);
export const tilt = (g: Game) => tiltDeg(g.birdVy);

/** Camera image and screen sizes, to map the pose model's 0..1 coordinates onto the aspect-filled preview. */
export interface View {
  screenW: number;
  screenH: number;
}

export interface PoseEvent {
  t: number;
  w: number;
  h: number;
  lm: number[];
}

const shoulders = (lm: Landmark[]) => [lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]].filter((p) => p[3] >= 0.3);

/** One pose result from the camera. Returns true when a new rep was counted. */
export function onPose(g: Game, ev: PoseEvent, view: View): { rep: boolean; end: EndReason | null } {
  const lm: Landmark[] | null = ev.lm.length >= 33 * 5 ? Array.from({ length: 33 }, (_, k) => ev.lm.slice(k * 5, k * 5 + 5) as Landmark) : null;
  const frame: PoseFrame = { i: g.frameI++, t: ev.t, ok: lm !== null, lm };
  // The body flies the bird, not the head (owner, 23 Sep: a nod must not dodge a pipe):
  // height of the shoulders that are visible. Aspect fill, the same as the preview layer.
  g.tracked = lm !== null && shoulders(lm).length > 0;
  if (lm && g.tracked && g.phase !== 'dying') {
    const scale = Math.max(view.screenW / ev.w, view.screenH / ev.h);
    const dy = (view.screenH - ev.h * scale) / 2;
    const bodyNorm = shoulders(lm).reduce((a, p) => a + p[1], 0) / shoulders(lm).length;
    const toWorld = (WORLD_W / view.screenW) * scale;
    const bodyY = (bodyNorm * ev.h * scale + dy) * (WORLD_W / view.screenW);
    const [L, R] = [lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]];
    const width = L[3] >= 0.3 && R[3] >= 0.3 ? Math.hypot((L[0] - R[0]) * ev.w, (L[1] - R[1]) * ev.h) * toWorld : null;
    g.smoothed = g.smoothed === null ? bodyY : g.smoothed + LIVE.smoothing * (bodyY - g.smoothed);
    if (g.phase === 'ready' && width !== null) {
      g.calibSamples.push({ t: ev.t, y: g.smoothed, span: width });
      while (g.calibSamples.length && g.calibSamples[0].t < ev.t - CALIBRATE_SEC) g.calibSamples.shift();
    }
    // Your average body height is the middle of the screen, wherever you are in the camera
    // (owner, 23 Sep: start from the centre); the bird moves around it as you go down and up.
    if (g.calib) {
      const depth = (g.smoothed - g.calib.plankY) / g.calib.span / PUSHUP_TRAVEL;
      g.birdTarget = Math.max(0.08 * g.worldH, Math.min(0.92 * g.worldH, g.worldH * (BAND_TOP + depth * (BAND_BOTTOM - BAND_TOP))));
    } else {
      g.birdTarget = g.worldH * BAND_TOP;
    }
  }
  g.lastCamT = ev.t;

  const before = g.detector.events.length;
  g.detector.step(frame);
  const rep = g.detector.events.length > before;
  if (rep && (g.phase === 'play' || g.phase === 'ready')) g.reps += 1;

  let end: EndReason | null = null;
  if (g.phase === 'play') {
    g.frames.push(frame);
    while (g.frames.length && g.frames[0].t < ev.t - 20) g.frames.shift();
    const reps = g.detector.events.filter((r) => r.t >= g.startCamT);
    if (reps.length) {
      const down = giveUpAt(g.frames, reps, GIVE_UP.on, GIVE_UP.hold, GIVE_UP.sec);
      if (down !== null && down > g.startCamT) {
        g.cutBackSec = ev.t - down;
        end = finish(g, 'gave up');
      }
    }
  }
  return { rep, end };
}

/** The STOP button. */
export const stop = (g: Game) => finish(g, 'stopped');

function finish(g: Game, reason: EndReason): EndReason {
  g.phase = 'over';
  g.endReason = reason;
  return reason;
}

/**
 * Gap centres live in the band the bird covers from plank (top) to a full push-up (bottom). Higher
 * levels push the bottom lower (deeper reps): +0.02 of the screen per level up to level 5.
 */
const bandBottomAt = (lvl: number) => BAND_BOTTOM + 0.02 * Math.min(4, lvl - 1);
/** How far the next gap may move across the band (level 1: half of it, level 5+: all of it) and how often it is forced to the other side. */
const swingAt = (lvl: number) => Math.min(1, 0.5 + 0.125 * (lvl - 1));
const forceOtherSideAt = (lvl: number) => Math.min(1, 0.5 + 0.125 * (lvl - 1));
/** Guess, to tune on the phone: seconds a body needs to go from the top of a push-up to the bottom. Caps a swing so every gap stays reachable. */
const FULL_RANGE_SEC = 0.7;

function spawn(g: Game, x: number, secSinceLast: number) {
  const lvl = level(g);
  const gap = gapAt(lvl, LIVE);
  const lo = g.worldH * BAND_TOP, hi = g.worldH * bandBottomAt(lvl);
  const dir = Math.random() < forceOtherSideAt(lvl) ? (g.lastGap >= 0.5 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;
  const move = Math.min(swingAt(lvl), secSinceLast / FULL_RANGE_SEC) * (0.6 + 0.4 * Math.random());
  let f = g.lastGap + dir * move;
  if (f < 0 || f > 1) f = g.lastGap - dir * move;
  g.lastGap = Math.max(0, Math.min(1, f));
  const margin = gap / 2 + 60;
  const centre = Math.max(margin, Math.min(g.worldH - margin, lo + g.lastGap * (hi - lo)));
  g.pipes.push({ k: g.nextK++, x, gapTop: centre - gap / 2, gapBottom: centre + gap / 2, passed: false, hit: false });
}

/** Advance the world by dt seconds. Returns the sounds to play and whether the run just ended. */
export function step(g: Game, dt: number): { sfx: Sfx[]; end: EndReason | null } {
  const sfx: Sfx[] = [];
  if (g.phase !== 'dying' && dt > 0) {
    const y = g.birdY + (g.birdTarget - g.birdY) * (1 - Math.exp(-dt / BIRD_EASE_SEC));
    g.birdVy = (y - g.birdY) / dt;
    g.birdY = y;
  }
  if (g.phase === 'ready') {
    g.readyT += dt;
    // Calibrate once the countdown is over and the last second of plank was all in view.
    const samples = g.calibSamples;
    const covered = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
    if (g.readyT >= g.countdownSec && g.tracked && covered >= CALIBRATE_SEC * 0.8) {
      g.calib = {
        plankY: samples.reduce((a, p) => a + p.y, 0) / samples.length,
        span: samples.reduce((a, p) => a + p.span, 0) / samples.length,
      };
      g.phase = 'play';
      g.startCamT = g.lastCamT;
      g.t = 0;
    }
  }
  if (g.phase === 'dying') {
    // The bird drops and tumbles; pipes freeze. Then the run is over.
    g.t += dt;
    g.birdVy += 3200 * dt;
    g.birdY = Math.min(g.worldH + 200, g.birdY + g.birdVy * dt);
    return { sfx, end: g.t - g.diedAt >= DEATH_SEC ? finish(g, 'died') : null };
  }
  if (g.phase !== 'play') return { sfx, end: null };
  g.t += dt;
  if (g.t >= g.durationSec) return { sfx, end: finish(g, 'time up') };
  const lvl = level(g);
  const speed = speedAt(lvl, LIVE);
  for (const p of g.pipes) p.x -= speed * dt;
  g.pipes = g.pipes.filter((p) => p.x + LIVE.pipeWidth > -100);

  const spawnX = WORLD_W + 40;
  const last = g.pipes[g.pipes.length - 1];
  if (!last) spawn(g, spawnX, Infinity);
  else {
    const distance = levelSpec(lvl, LIVE).distance * g.mode.distanceScale;
    if (last.x <= spawnX - distance) spawn(g, last.x + distance, distance / speed);
  }

  for (const p of g.pipes) {
    const overlaps = p.x - CAP_OVER < BIRD_X + BIRD_R && p.x + LIVE.pipeWidth + CAP_OVER > BIRD_X - BIRD_R;
    if (!p.hit && overlaps && (g.birdY - BIRD_R < p.gapTop || g.birdY + BIRD_R > p.gapBottom)) {
      p.hit = true;
      g.hits += 1;
      g.lives -= 1;
      g.hitAt = g.t;
      sfx.push('boom.wav');
      if (g.lives <= 0) {
        g.phase = 'dying';
        g.diedAt = g.t;
        g.birdVy = -900;
        return { sfx, end: null };
      }
    }
    if (!p.passed && p.x + LIVE.pipeWidth < BIRD_X - BIRD_R) {
      p.passed = true;
      if (!p.hit) {
        g.score += 1;
        g.passAt = g.t;
        if (level(g) > lvl) {
          g.levelUpAt = g.t;
          sfx.push('levelup.wav');
        }
      }
    }
  }
  return { sfx, end: null };
}
