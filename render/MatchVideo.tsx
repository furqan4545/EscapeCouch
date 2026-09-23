import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { MatchConfig, MatchFrame, PoseFile } from "../engine/types";
import { Countdown, Header, RepRing, ResultCard, Skeleton } from "./hud";

export interface MatchData {
  config: MatchConfig;
  result: { yourReps: number; ghostReps: number; winner: "you" | "ghost" | "draw" };
  frames: MatchFrame[];
}

export interface MatchVideoProps {
  take: string;
  match: MatchData | null;
  landmarks: PoseFile | null;
  /** Source frame index that composition frame 0 shows. */
  offsetFrames: number;
  /** Remotion types composition props as Record<string, unknown>. */
  [key: string]: unknown;
}

/**
 * The app screen: the owner's clip underneath, the HUD on top. Every visual reads from one
 * MatchFrame, so the phone app can drive the same components from live state later.
 */
export const MatchVideo: React.FC<MatchVideoProps> = ({ take, match, landmarks, offsetFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!match || !landmarks) return <AbsoluteFill style={{ background: "#000" }} />;

  const i = Math.min(match.frames.length - 1, frame + offsetFrames);
  const m = match.frames[i];
  const lm = landmarks.frames[i]?.lm ?? null;
  const overSec = m.status === "over" ? m.clock - match.config.durationSec : 0;

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <OffthreadVideo src={staticFile(`render/${take}/video.mp4`)} startFrom={offsetFrames} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <Skeleton lm={lm} />
      <Header m={m} cfg={match.config} />
      <RepRing m={m} />
      {m.status === "countdown" && <Countdown secondsLeft={-m.clock} />}
      {m.status === "over" && overSec > 0.4 && <ResultCard result={match.result} cfg={match.config} sinceSec={overSec - 0.4} fps={fps} />}
    </AbsoluteFill>
  );
};
