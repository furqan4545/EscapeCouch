// Shared shapes for the game core. The same code runs offline over a landmarks file (renderer)
// and later frame by frame on the phone (app). Nothing in engine/ may import MediaPipe or Remotion.

/** One BlazePose point: x, y normalized to the frame (0..1), z relative depth, visibility, presence. */
export type Landmark = [number, number, number, number, number];

export interface PoseFrame {
  i: number;
  t: number;
  ok: boolean;
  lm: Landmark[] | null;
}

export interface PoseFile {
  video: string;
  fps: number;
  width: number;
  height: number;
  frames: PoseFrame[];
}

/** BlazePose indices the engine reads. Full list: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker */
export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
} as const;

export interface RepEvent {
  /** Second the rep was credited (top of the push). */
  t: number;
  /** Frame index the rep was credited. */
  i: number;
  /** Smallest elbow angle reached during the descent, degrees. Lower = deeper. */
  depthDeg: number;
  /** Seconds from leaving the top to returning to it. */
  durationSec: number;
}

export type Phase = "idle" | "down" | "up";

export interface FrameState {
  i: number;
  t: number;
  tracked: boolean;
  /** Smoothed mean elbow angle, degrees. */
  elbowDeg: number;
  /** 0 at the top of a push-up, 1 at the configured "down" angle. Drives HUD motion. */
  depth: number;
  phase: Phase;
  reps: number;
}

export interface RepDetectorOptions {
  /** Elbow angle below which the body counts as "down". */
  downDeg: number;
  /** Elbow angle above which the body counts as "up" again. */
  upDeg: number;
  /** Exponential smoothing factor for the angle, 0..1 (1 = no smoothing). */
  smoothing: number;
  /** Shortest believable rep, seconds. Faster transitions are jitter. */
  minRepSec: number;
  /** Landmark visibility below which an elbow is ignored. */
  minVisibility: number;
  /** Seconds the arms must be locked out (above upDeg) before a descent can start a rep. Kills the "getting into position" wobble. */
  settleSec: number;
}

// Tuned on take1 (23 Sep): full reps bottom out at 60-70°, shallow dips stop at 104-110°,
// and the first second is the owner straightening up from his knees.
export const DEFAULT_REP_OPTIONS: RepDetectorOptions = {
  downDeg: 95,
  upDeg: 150,
  smoothing: 0.5,
  minRepSec: 0.4,
  minVisibility: 0.3,
  settleSec: 0.5,
};

/** A competitor's rep timeline: when each rep landed, in seconds from match start. */
export interface Ghost {
  name: string;
  elo: number;
  repTimes: number[];
  source: "recorded" | "authored";
}

export interface MatchConfig {
  /** Seconds the match runs. Arena uses 60. */
  durationSec: number;
  /** Second of the source clip at which the match clock starts. */
  startT: number;
  fps: number;
  you: { name: string; elo: number };
  ghost: Ghost;
}

export interface MatchFrame {
  i: number;
  t: number;
  /** Seconds since the match clock started. */
  clock: number;
  timeLeft: number;
  yourReps: number;
  ghostReps: number;
  /** -1 = ghost far ahead, 0 = level, +1 = you far ahead. */
  bar: number;
  depth: number;
  phase: Phase;
  status: "countdown" | "live" | "over";
}

export interface MatchResult {
  yourReps: number;
  ghostReps: number;
  winner: "you" | "ghost" | "draw";
  frames: MatchFrame[];
}
