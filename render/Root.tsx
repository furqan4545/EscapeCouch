import { Composition, staticFile } from "remotion";
import { birdTrack, DEFAULT_FLAPPY, fitPipes, giveUpAt } from "../engine/flappy";
import { painMoments } from "../engine/pain";
import { COUNTDOWN_SEC } from "../engine/match";
import { FlappyVideo, type FlappyVideoProps } from "./FlappyVideo";
import { MatchVideo, type MatchVideoProps } from "./MatchVideo";

/** Seconds of the source clip shown before the countdown starts and after the clock ends. */
export const LEAD_IN_SEC = 1;
export const TAIL_SEC = 3.5;

// One composition, "match". The take name picks the files render/prepare.ts put in public/render/<take>/.
// calculateMetadata reads them, sizes the composition to the match window, and hands the data to the component.
export const Root = () => (
  <>
  <Composition
    id="flappy"
    component={FlappyVideo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30 * 60}
    defaultProps={{ take: "take1", startSec: -1, endSec: -1, offsetFrames: 0, speed: 1.5, track: null, pipes: null, opts: DEFAULT_FLAPPY, header: true, player: { name: "Furqan", avatar: "avatar.jpg" }, elo: 1247, caption: "Push day killer 💀", music: "audio/goggins.m4a", musicVolume: 0.9, dings: false, levelSfx: true, booms: [] } as FlappyVideoProps}
    calculateMetadata={async ({ props }) => {
      // Window defaults to 2.5 s before the first counted rep until the moment the owner gives up (knees down, no rep after); a hard cut there.
      const base = `render/${props.take}`;
      const [landmarks, reps, face] = await Promise.all([
        fetch(staticFile(`${base}/landmarks.json`)).then((r) => r.json()),
        fetch(staticFile(`${base}/reps.json`)).then((r) => r.json()).catch(() => null),
        fetch(staticFile(`${base}/face.json`)).then((r) => r.json()).catch(() => null),
      ]);
      const fps = landmarks.fps as number;
      const clipEnd = landmarks.frames.length / fps;
      const first = reps?.reps?.[0]?.t, last = reps?.reps?.[reps.reps.length - 1]?.t;
      const startSec = props.startSec >= 0 ? props.startSec : Math.max(0, (first ?? 0) - 2.5);
      const giveUp = reps?.reps?.length ? giveUpAt(landmarks.frames, reps.reps) : null;
      const endSec = props.endSec >= 0 ? Math.min(clipEnd, props.endSec) : Math.min(clipEnd, giveUp ?? (last ?? clipEnd) + 1);
      const speed = props.speed > 0 ? props.speed : 1;
      // The level table is in on-screen units; the engine converts with the playback speed.
      const opts = { ...DEFAULT_FLAPPY, ...props.opts, playback: speed };
      const track = birdTrack(landmarks.frames, startSec, endSec, opts);
      const pipes = fitPipes(track, startSec, endSec, opts);
      // Booms fire only on a pained face (grimace score from facial blendshapes, engine/pain.ts). No face data, no booms.
      const booms = props.booms?.length ? props.booms : face ? painMoments(face, startSec + 1, endSec - 0.8).map((m) => ({ t: m.t, hold: m.hold })) : [];
      return { fps, durationInFrames: Math.max(1, Math.floor(track.length / speed)), props: { ...props, startSec, endSec, speed, offsetFrames: Math.round(startSec * fps), track, pipes, opts, booms } };
    }}
  />
  <Composition
    id="match"
    component={MatchVideo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={30 * 70}
    defaultProps={{ take: "take1", match: null, landmarks: null, offsetFrames: 0 } as MatchVideoProps}
    calculateMetadata={async ({ props }) => {
      const base = `render/${props.take}`;
      const [match, landmarks] = await Promise.all([
        fetch(staticFile(`${base}/match.json`)).then((r) => r.json()),
        fetch(staticFile(`${base}/landmarks.json`)).then((r) => r.json()),
      ]);
      const fps = match.config.fps as number;
      const startT = match.config.startT as number;
      const windowStart = Math.max(0, startT - COUNTDOWN_SEC - LEAD_IN_SEC);
      const windowEnd = Math.min(landmarks.frames.length / fps, startT + match.config.durationSec + TAIL_SEC);
      return {
        fps,
        durationInFrames: Math.round((windowEnd - windowStart) * fps),
        props: { ...props, match, landmarks, offsetFrames: Math.round(windowStart * fps) },
      };
    }}
  />
  </>
);
