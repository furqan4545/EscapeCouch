import { DEFAULT_REP_OPTIONS, LM, type FrameState, type Landmark, type PoseFrame, type RepDetectorOptions, type RepEvent } from "./types";

/** Angle at b, in degrees, between b->a and b->c using the 2D image coordinates. */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a[0] - b[0], v1y = a[1] - b[1];
  const v2x = c[0] - b[0], v2y = c[1] - b[1];
  const dot = v1x * v2x + v1y * v2y;
  const n1 = Math.hypot(v1x, v1y) || 1e-9;
  const n2 = Math.hypot(v2x, v2y) || 1e-9;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (n1 * n2)))) * 180) / Math.PI;
}

/** Mean elbow angle over the elbows that are visible enough; null when neither is. */
export function elbowAngle(lm: Landmark[], minVisibility: number): number | null {
  const sides: [number, number, number][] = [
    [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST],
    [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST],
  ];
  const angles = sides
    .filter(([s, e, w]) => Math.min(lm[s][3], lm[e][3], lm[w][3]) >= minVisibility)
    .map(([s, e, w]) => angleDeg(lm[s], lm[e], lm[w]));
  return angles.length ? angles.reduce((a, b) => a + b, 0) / angles.length : null;
}

/**
 * Rep detector. A rep is credited on the way UP: the elbows must have closed past `downDeg`
 * and then opened past `upDeg`. Hysteresis between the two thresholds stops a single wobble
 * from counting twice. Runs frame by frame, so the phone can call `step` live with the same code.
 */
export class RepDetector {
  private readonly o: RepDetectorOptions;
  private smoothed: number | null = null;
  private phase: "idle" | "down" | "up" = "idle";
  private downStartT = 0;
  private minAngleInDown = 999;
  private lastRepT = -Infinity;
  private upSinceT: number | null = null;
  private armed = false;
  private reps: RepEvent[] = [];

  constructor(options: Partial<RepDetectorOptions> = {}) {
    this.o = { ...DEFAULT_REP_OPTIONS, ...options };
  }

  get events(): RepEvent[] {
    return this.reps;
  }

  step(frame: PoseFrame): FrameState {
    const raw = frame.ok && frame.lm ? elbowAngle(frame.lm, this.o.minVisibility) : null;
    if (raw !== null) this.smoothed = this.smoothed === null ? raw : this.smoothed + this.o.smoothing * (raw - this.smoothed);
    const angle = this.smoothed ?? 180;

    // A descent only arms a rep once the arms have been locked out for settleSec.
    if (this.phase !== "down") {
      if (angle > this.o.upDeg) {
        this.upSinceT ??= frame.t;
        if (frame.t - this.upSinceT >= this.o.settleSec) this.armed = true;
      } else if (angle >= this.o.downDeg) {
        this.upSinceT = null;
      }
    }

    if (this.phase !== "down" && angle < this.o.downDeg) {
      this.phase = "down";
      this.downStartT = frame.t;
      this.minAngleInDown = angle;
      this.upSinceT = null;
    } else if (this.phase === "down") {
      this.minAngleInDown = Math.min(this.minAngleInDown, angle);
      if (angle > this.o.upDeg) {
        this.phase = "up";
        const wasArmed = this.armed;
        this.armed = false;
        this.upSinceT = frame.t;
        if (wasArmed && frame.t - this.lastRepT >= this.o.minRepSec) {
          this.reps.push({ t: frame.t, i: frame.i, depthDeg: Math.round(this.minAngleInDown), durationSec: Math.round((frame.t - this.downStartT) * 100) / 100 });
          this.lastRepT = frame.t;
        }
      }
    }

    const span = 180 - this.o.downDeg;
    const depth = Math.max(0, Math.min(1, (180 - angle) / span));
    return { i: frame.i, t: frame.t, tracked: raw !== null, elbowDeg: Math.round(angle * 10) / 10, depth: Math.round(depth * 1000) / 1000, phase: this.phase, reps: this.reps.length };
  }
}

/** Convenience for the offline path: whole file in, per-frame states and rep events out. */
export function detectReps(frames: PoseFrame[], options: Partial<RepDetectorOptions> = {}): { states: FrameState[]; reps: RepEvent[] } {
  const d = new RepDetector(options);
  const states = frames.map((f) => d.step(f));
  return { states, reps: d.events };
}
