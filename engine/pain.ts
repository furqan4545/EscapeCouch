// Pain detection from facial blendshapes, for the boom zoom. Owner, 23 Sep: "trigger sudden zoom in
// only on painful face, not on normal face at all".
//
// Score = grimace: mean(mouthSmileLeft/Right) + 2 x mean(mouthStretchLeft/Right) + 2 x mean(mouthUpperUpLeft/Right).
// Why not PSPI (the textbook facial pain measure: brow lowerer + eye squeeze + nose wrinkle + eyes
// closed)? Measured on take1 against frames labelled by eye from a 0.5 s face grid (54 grimace frames,
// 335 normal or looking-down frames): the owner's pain face is a bared-teeth grimace. The model reads
// it as a pulled-back smile (mouthSmile 0.52 vs 0.07 on normal frames, separates 94% of pairs) with lip
// stretch (0.09 vs 0.02, 90%). His brows go the other way (browDown 0.14 grimacing vs 0.26 normal vs
// 0.37 looking down), which is why PSPI fired on him looking at the floor and missed the real grimaces.
// Lip-corner pull and lip stretch are part of the pain grimace in the pain literature too.
// Resting faces differ per person, so moments are picked on the excess over this take's median.
// A flicker must not fire a boom, so the score is smoothed and must stay high for a while.
// Pure functions: the phone can run the same scoring live on FaceLandmarker output.

export interface FaceFrame {
  i: number;
  t: number;
  ok: boolean;
  bs: number[] | null;
  box: number[] | null;
}

export interface FaceFile {
  fps: number;
  names: string[];
  frames: FaceFrame[];
}

export interface PainSample {
  t: number;
  /** Raw grimace score for this frame, or null when no face was found. */
  score: number | null;
  /** Centred moving average of score over smoothSec. */
  smooth: number | null;
}

export interface PainOptions {
  /** Moving-average window, seconds of clip time. */
  smoothSec: number;
  /** A moment needs the smoothed score this far above the take's median. */
  minExcess: number;
  /** ...and stay there at least this long, clip seconds. Kills flickers. */
  minHoldSec: number;
  /** The zoom holds for the grimace's length, clamped to [minZoomHoldSec, maxHoldSec] clip seconds. */
  minZoomHoldSec: number;
  maxHoldSec: number;
  /** Booms at least this far apart, clip seconds. */
  minGapSec: number;
  /** At most this many booms per video; the strongest win. */
  max: number;
  /** Start the zoom this many clip seconds before the grimace crosses the threshold, so it is fully in when the face turns. */
  leadSec: number;
}

export const DEFAULT_PAIN: PainOptions = {
  smoothSec: 0.25,
  minExcess: 0.3,
  minHoldSec: 0.2,
  minZoomHoldSec: 0.5,
  maxHoldSec: 1.5,
  minGapSec: 2.4,
  max: 5,
  leadSec: 0.15,
};

const mean2 = (bs: number[], idx: Record<string, number>, a: string, b: string) => (bs[idx[a]] + bs[idx[b]]) / 2;

/** Grimace score per frame from blendshapes. */
export function painTrack(face: FaceFile, o: PainOptions = DEFAULT_PAIN): PainSample[] {
  const idx: Record<string, number> = Object.fromEntries(face.names.map((n, k) => [n, k]));
  const raw = face.frames.map((f) => {
    if (!f.ok || !f.bs) return null;
    const bs = f.bs;
    return mean2(bs, idx, "mouthSmileLeft", "mouthSmileRight") + 2 * mean2(bs, idx, "mouthStretchLeft", "mouthStretchRight") + 2 * mean2(bs, idx, "mouthUpperUpLeft", "mouthUpperUpRight");
  });
  const half = Math.max(1, Math.round((o.smoothSec * face.fps) / 2));
  return face.frames.map((f, k) => {
    const win = raw.slice(Math.max(0, k - half), k + half + 1).filter((v): v is number => v !== null);
    return { t: f.t, score: raw[k] === null ? null : Math.round(raw[k]! * 1000) / 1000, smooth: win.length >= half ? Math.round((win.reduce((a, b) => a + b, 0) / win.length) * 1000) / 1000 : null };
  });
}

export interface PainMoment {
  /** Clip second the zoom starts: just before the grimace crosses the threshold. */
  t: number;
  /** Clip seconds the grimace stays above the threshold (the zoom holds this long). */
  hold: number;
  /** Clip second of the worst frame. */
  peak: number;
  /** Peak excess over the take's median. */
  strength: number;
}

/**
 * Grimace moments in [startT, endT] (clip seconds). A moment is a run of frames whose smoothed score
 * sits at least minExcess above the take's median; runs split by a flicker shorter than 0.15 s are
 * merged, runs shorter than minHoldSec are dropped. The strongest runs win, onsets at least minGapSec
 * apart, at most `max`, returned in time order. An empty list is a valid answer: a calm face never booms.
 */
export function painMoments(face: FaceFile, startT: number, endT: number, o: PainOptions = DEFAULT_PAIN): PainMoment[] {
  const track = painTrack(face, o).filter((s) => s.t >= startT && s.t <= endT);
  const vals = track.map((s) => s.smooth).filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!vals.length) return [];
  const median = vals[Math.floor(vals.length / 2)];
  const on = track.map((s) => s.smooth !== null && s.smooth - median >= o.minExcess);
  const runs: { a: number; b: number }[] = [];
  for (let k = 0; k < track.length; k++) {
    if (!on[k]) continue;
    let e = k;
    while (e + 1 < track.length && on[e + 1]) e++;
    const last = runs[runs.length - 1];
    if (last && track[k].t - track[last.b].t < 0.15) last.b = e;
    else runs.push({ a: k, b: e });
    k = e;
  }
  const moments: PainMoment[] = runs
    .filter((r) => track[r.b].t - track[r.a].t >= o.minHoldSec)
    .map((r) => {
      let pk = r.a;
      for (let k = r.a; k <= r.b; k++) if ((track[k].smooth ?? 0) > (track[pk].smooth ?? 0)) pk = k;
      const onset = track[r.a].t, offset = track[r.b].t, peak = track[pk].t;
      const hold = Math.min(o.maxHoldSec, Math.max(o.minZoomHoldSec, offset - onset));
      // A grimace longer than the hold cap: place the hold window around the worst frame, not at the onset.
      const start = offset - onset > o.maxHoldSec ? Math.min(Math.max(onset, peak - hold * 0.6), offset - hold) : onset;
      return { t: Math.round((start - o.leadSec) * 100) / 100, hold: Math.round(hold * 100) / 100, peak, strength: Math.round(((track[pk].smooth ?? 0) - median) * 100) / 100 };
    });
  const picked: PainMoment[] = [];
  for (const m of moments.sort((x, y) => y.strength - x.strength)) {
    if (picked.every((q) => Math.abs(q.t - m.t) >= o.minGapSec)) picked.push(m);
    if (picked.length >= o.max) break;
  }
  return picked.sort((x, y) => x.t - y.t);
}
