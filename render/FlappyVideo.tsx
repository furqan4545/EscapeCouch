import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DEFAULT_ELO, DEFAULT_FLAPPY, eloGain, lapElo, levelAt, pipeLeft, scoreAt, tiltDeg, type BirdSample, type EloRule, type FlappyOptions, type Pipe } from "../engine/flappy";

// Fonts load before the first frame renders (loadFont holds the render until they are ready).
loadFont({ family: "Lilita One", url: staticFile("fonts/LilitaOne-Regular.ttf"), weight: "400" });
loadFont({ family: "TikTok Sans", url: staticFile("fonts/TikTokSans-Medium.ttf"), weight: "500" });

export interface FlappyVideoProps {
  take: string;
  /** Source clip second shown at composition frame 0. */
  startSec: number;
  endSec: number;
  offsetFrames: number;
  /** Playback speed of the clip: 1.5 = everything moves 1.5x faster. */
  speed: number;
  track: BirdSample[] | null;
  pipes: Pipe[] | null;
  opts: FlappyOptions;
  /** Game HUD: player panel on the right (avatar, level gem, name, ELO, score, level rail). Off = the reference video's look: bird, pipes, caption only. */
  header: boolean;
  /** Name and avatar image (path under public/) for the player panel. */
  player: { name: string; avatar: string };
  /** Starting ELO shown in the HUD; each completed lap (level) adds ELO per `eloRule` (default +1 a lap, +3 a lap after 5 laps). */
  elo: number;
  eloRule?: EloRule;
  /** TikTok-native caption text. Empty = none. */
  caption: string;
  /** Path under public/, e.g. "audio/goggins.m4a". Empty = no music. */
  music: string;
  musicVolume: number;
  /** Ding on every pipe. Off by default: it fights the hype track. */
  dings: boolean;
  /** Sting + burst every levelEvery pipes. */
  levelSfx: boolean;
  /** Boom zooms: start (clip s) and how long the grimace lasts (clip s). Empty = auto: only where the face shows pain (engine/pain.ts). */
  booms: { t: number; hold?: number }[];
  [key: string]: unknown;
}

/** House rule (owner, 24 Aug): every sound effect plays at 70% of its natural level, one-shot, never looped. Music beds are exempt. */
export const SFX_LEVEL = 0.7;
const PIPE = { body: "#E98B71", light: "#F4A98F", dark: "#C4664C", rim: "#8E432E" };
const HUD_FONT = "'Lilita One', 'Arial Black', sans-serif";
/** Outline and hard-shadow colour for all HUD text: a warm near-black that sits with the salmon pipes. */
const INK = "#2B160E";
const CREAM = "#FFE7C2";
/** One colour per level; the gem, the rail fill and the level-up burst all take it. */
const LEVEL_COLORS = ["#FFC53D", "#35E0CF", "#FF6FA8", "#A98CFF", "#FF5B4E"];
const levelColor = (level: number) => LEVEL_COLORS[(Math.max(1, level) - 1) % LEVEL_COLORS.length];
const lighten = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

/** Boom: snap in on the face, hold while the grimace lasts, ease out. Seconds of the finished video. */
const BOOM_IN = 0.1, BOOM_OUT = 0.45, BOOM_SCALE = 1.7, BOOM_MIN_HOLD = 0.33;
/** Where the zoomed face is placed: centred, below the caption, left of the player panel. */
const BOOM_TARGET = { x: 540, y: 900 };
/** 0 = no zoom, 1 = fully zoomed. */
const boomAmount = (since: number, hold: number) =>
  since < 0 ? 0 : since < BOOM_IN ? since / BOOM_IN : since < BOOM_IN + hold ? 1 : since < BOOM_IN + hold + BOOM_OUT ? 1 - (1 - Math.pow(1 - (since - BOOM_IN - hold) / BOOM_OUT, 3)) : 0;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The owner's clip underneath at `speed`; pipes and bird on it; caption, HUD and level-ups fixed on top. */
export const FlappyVideo: React.FC<FlappyVideoProps> = ({ take, offsetFrames, speed, track, pipes, opts, header, player, elo, eloRule = DEFAULT_ELO, caption, music, musicVolume, dings, levelSfx, booms }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!track || !pipes) return <AbsoluteFill style={{ background: "#000" }} />;
  const o = { ...DEFAULT_FLAPPY, ...opts };
  const idx = Math.min(track.length - 1, Math.round(frame * speed));
  const s = track[idx];
  const t = s.t;
  const visible = pipes.filter((p) => { const x = pipeLeft(p, t, pipes, o); return x > -o.pipeWidth - 40 && x < o.width + 40; });
  const flap = Math.floor((frame / fps) * 9) % 3;
  const score = scoreAt(pipes, t);
  const level = levelAt(score, o);
  const lastPass = pipes.filter((p) => p.passT <= t).pop();
  const sincePass = lastPass ? (t - lastPass.passT) / speed : 99;
  const levelUpAt = pipes.filter((p) => (p.k + 1) % o.levelEvery === 0 && p.passT <= t).pop();
  const sinceLevel = levelUpAt ? (t - levelUpAt.passT) / speed : 99;
  const compFrameOf = (clipT: number) => Math.round(((clipT - track[0].t) / speed) * fps);

  // Boom zoom: follows the face (nose, smoothed over 7 frames), scales it up and slides it to BOOM_TARGET,
  // clamped so the scaled frame always covers the canvas. Pipes and bird stay on screen and zoom with the
  // camera (owner, 23 Sep: "bring back the wall"). Caption, panel and level-ups stay put.
  const boom = booms.map((b) => ({ t: b.t, hold: Math.max(BOOM_MIN_HOLD, (b.hold ?? 0.675) / speed), since: (t - b.t) / speed })).find((b) => b.since >= 0 && b.since < BOOM_IN + b.hold + BOOM_OUT);
  const zoom = boom ? boomAmount(boom.since, boom.hold) : 0;
  const near = track.slice(Math.max(0, idx - 3), idx + 4);
  const fx = near.reduce((a, q) => a + q.faceX, 0) / near.length, fy = near.reduce((a, q) => a + q.faceY, 0) / near.length;
  const scale = 1 + (BOOM_SCALE - 1) * zoom;
  const tx = clamp(zoom * (BOOM_TARGET.x - fx), (o.width - fx) * (1 - scale), fx * (scale - 1));
  const ty = clamp(zoom * (BOOM_TARGET.y - fy), (o.height - fy) * (1 - scale), fy * (scale - 1));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {music && <Audio src={staticFile(music)} volume={musicVolume} />}
      {dings && pipes.filter((p) => (p.k + 1) % o.levelEvery !== 0).map((p) => (
        <Sequence key={`d${p.k}`} from={compFrameOf(p.passT)} durationInFrames={8} layout="none"><Audio src={staticFile("audio/ding.wav")} volume={SFX_LEVEL} /></Sequence>
      ))}
      {levelSfx && pipes.filter((p) => (p.k + 1) % o.levelEvery === 0).map((p) => (
        <Sequence key={`l${p.k}`} from={compFrameOf(p.passT)} durationInFrames={20} layout="none"><Audio src={staticFile("audio/levelup.wav")} volume={SFX_LEVEL} /></Sequence>
      ))}
      {booms.map((b, i) => (
        <Sequence key={`b${i}`} from={compFrameOf(b.t)} durationInFrames={40} layout="none"><Audio src={staticFile("BG_SFX/vine-boom.mp3")} volume={SFX_LEVEL} /></Sequence>
      ))}
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: `${fx}px ${fy}px` }}>
        <OffthreadVideo src={staticFile(`render/${take}/video.mp4`)} startFrom={offsetFrames} playbackRate={speed} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {visible.map((p) => <PipePair key={p.k} left={pipeLeft(p, t, pipes, o)} gapTop={p.gapTop} gapBottom={p.gapBottom} o={o} />)}
        <div style={{ position: "absolute", left: o.birdX * o.width - 84, top: s.y - 72, transform: `rotate(${tiltDeg(s.vy)}deg)`, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.35))" }}><Bird width={168} flap={flap} /></div>
      </AbsoluteFill>
      {boom && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: interpolate(boom.since, [0, 0.05, 0.25], [0, 0.35, 0], { extrapolateRight: "clamp" }) }} />}
      {caption && <Caption text={caption} top={215} />}
      {header && <PlayerPanel player={player} score={score} level={level} levelEvery={o.levelEvery} sincePass={sincePass} sinceLevel={sinceLevel} elo={elo} eloRule={eloRule} flap={flap} />}
      {levelSfx && sinceLevel < 1.6 && <LevelUp level={level} since={sinceLevel} />}
    </AbsoluteFill>
  );
};

/** Outlined game text: a hard INK shadow copy, then the fill with an outer outline (stroke painted under the fill). */
const GameText: React.FC<{ x: number; y: number; size: number; fill: string; outline: number; shadow?: number; anchor?: "start" | "middle" | "end"; spacing?: number; opacity?: number; children: React.ReactNode }> = ({ x, y, size, fill, outline, shadow = 0, anchor = "middle", spacing = 0, opacity = 1, children }) => {
  const common = { x, textAnchor: anchor, fontFamily: HUD_FONT, fontSize: size, letterSpacing: spacing, stroke: INK, strokeWidth: outline * 2, strokeLinejoin: "round" as const, style: { paintOrder: "stroke" } as React.CSSProperties, opacity };
  return (
    <>
      {shadow > 0 && <text {...common} y={y + shadow} fill={INK}>{children}</text>}
      <text {...common} y={y} fill={fill}>{children}</text>
    </>
  );
};

// Player panel geometry on the 1080x1920 canvas. Measured on take1 (23 Sep): the face never goes
// left of x 386 or right of x 751, and the bird owns x 154-322, so the panel lives at x >= 820 where
// neither ever goes. It starts level with the native caption (215-286), which sits to its left.
const PANEL_CX = 940;
const AVATAR_CY = 262, AVATAR_D = 120;
const NAME_Y = 370, ELO_Y = 412, SCORE_LABEL_Y = 452, SCORE_Y = 538;
const RAIL_X0 = 835, RAIL_X1 = 1045, RAIL_CY = 576, RAIL_H = 12;

/**
 * No panel background. Avatar in a ring of the level colour with the level gem on its corner, name,
 * trophy + ELO, the score, and a slim 15-step rail where a mini bird moves one step per pipe.
 * All text is outlined in INK so it reads on a bright room.
 */
const PlayerPanel: React.FC<{ player: { name: string; avatar: string }; score: number; level: number; levelEvery: number; sincePass: number; sinceLevel: number; elo: number; eloRule: EloRule; flap: number }> = ({ player, score, level, levelEvery, sincePass, sinceLevel, elo, eloRule, flap }) => {
  const justLeveled = level > 1 && sinceLevel < 0.5;
  const color = levelColor(level);
  const bounce = 1 + 0.14 * Math.max(0, 1 - sincePass / 0.22);
  const pop = level > 1 ? 1 + 0.18 * Math.max(0, 1 - sinceLevel / 0.35) : 1;
  // ELO counts up after each completed lap (lap = level), with a +N floater.
  const laps = level - 1;
  const lastGain = laps > 0 ? lapElo(laps, eloRule) : 0;
  const eloTarget = elo + eloGain(laps, eloRule);
  const eloShown = laps > 0 && sinceLevel < 0.6 ? Math.round(eloTarget - lastGain * (1 - Math.min(1, sinceLevel / 0.6))) : eloTarget;
  const steps = score % levelEvery;
  const tween = Math.min(1, sincePass / 0.18);
  const shown = justLeveled ? levelEvery : steps > 0 ? steps - 1 + (1 - Math.pow(1 - tween, 3)) : 0;
  const railColor = justLeveled ? levelColor(level - 1) : color;
  const railW = RAIL_X1 - RAIL_X0;
  const fillW = (shown / levelEvery) * railW;

  return (
    <>
      {/* Avatar: HTML so Remotion waits for the image. Ring = level colour, INK outline + hard shadow. */}
      <div style={{ position: "absolute", left: PANEL_CX - AVATAR_D / 2, top: AVATAR_CY - AVATAR_D / 2, width: AVATAR_D, height: AVATAR_D, borderRadius: "50%", boxSizing: "border-box", border: `7px solid ${color}`, boxShadow: `0 0 0 5px ${INK}, 0 8px 0 5px ${INK}`, overflow: "hidden", transform: `scale(${pop})`, background: INK }}>
        <Img src={staticFile(player.avatar)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <svg width={1080} height={700} viewBox="0 0 1080 700" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id="gem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lighten(color, 0.45)} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
          <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={lighten(railColor, 0.35)} />
            <stop offset="1" stopColor={railColor} />
          </linearGradient>
        </defs>

        {/* Level gem on the avatar's lower-right corner */}
        <g transform={`translate(${PANEL_CX + 46} ${AVATAR_CY + 46}) scale(${level > 1 ? 1 + 0.35 * Math.max(0, 1 - sinceLevel / 0.35) : 1})`}>
          <polygon points={hexPoints(0, 0, 30)} fill={INK} transform="translate(0 5)" />
          <polygon points={hexPoints(0, 0, 30)} fill="url(#gem)" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <GameText x={0} y={11} size={30} fill="#fff" outline={5}>{level}</GameText>
        </g>

        {/* Name, ELO */}
        <GameText x={PANEL_CX} y={NAME_Y} size={34} fill="#fff" outline={6} shadow={4}>{player.name}</GameText>
        {/* "ELO 1248": small cream label + the number, centred as one line (shadow copy first) */}
        {[{ dy: 4, label: INK, num: INK }, { dy: 0, label: CREAM, num: "#fff" }].map((v, k) => (
          <text key={k} x={PANEL_CX} y={ELO_Y + v.dy} textAnchor="middle" fontFamily={HUD_FONT} stroke={INK} strokeLinejoin="round" style={{ paintOrder: "stroke" }}>
            <tspan fontSize={24} letterSpacing={2} fill={v.label} strokeWidth={9}>ELO </tspan>
            <tspan fontSize={34} fill={v.num} strokeWidth={12}>{eloShown}</tspan>
          </text>
        ))}
        {level > 1 && sinceLevel < 1 && (
          <GameText x={PANEL_CX - 78} y={ELO_Y - 40 * Math.min(1, sinceLevel)} size={30} fill="#7CFF9B" outline={5} anchor="end" opacity={1 - Math.min(1, sinceLevel)}>+{lastGain}</GameText>
        )}

        {/* Score */}
        <GameText x={PANEL_CX} y={SCORE_LABEL_Y} size={20} fill={CREAM} outline={4} spacing={4}>SCORE</GameText>
        <g transform={`translate(${PANEL_CX} ${SCORE_Y - 36}) scale(${bounce}) translate(${-PANEL_CX} ${-(SCORE_Y - 36)})`}>
          <GameText x={PANEL_CX} y={SCORE_Y} size={100} fill="#fff" outline={8} shadow={7}>{score}</GameText>
        </g>

        {/* Level rail with the mini bird */}
        <rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2 + 4} width={railW} height={RAIL_H} rx={RAIL_H / 2} fill={INK} opacity={0.9} />
        <rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2} width={railW} height={RAIL_H} rx={RAIL_H / 2} fill="rgba(43, 22, 14, 0.45)" stroke="#fff" strokeOpacity={0.92} strokeWidth={3} />
        {fillW > 1 && <rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2} width={Math.max(RAIL_H, fillW)} height={RAIL_H} rx={RAIL_H / 2} fill="url(#rail)" stroke={INK} strokeWidth={3} />}
        {Array.from({ length: levelEvery - 1 }, (_, k) => k + 1).filter((k) => k > shown + 0.3).map((k) => (
          <circle key={k} cx={RAIL_X0 + (k / levelEvery) * railW} cy={RAIL_CY} r={2.2} fill="#fff" opacity={0.85} />
        ))}
        <g transform={`translate(${RAIL_X0 + fillW - 23} ${RAIL_CY - 24 - (justLeveled ? 8 * Math.sin((sinceLevel / 0.5) * Math.PI) : 0)})`}><Bird width={46} flap={flap} /></g>
      </svg>
    </>
  );
};

const hexPoints = (cx: number, cy: number, r: number) =>
  [-90, -30, 30, 90, 150, 210].map((a) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)},${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`).join(" ");

/** TikTok-native caption: TikTok Sans Medium, white, 11/56 black outline, soft shadow. Emoji from the system font. */
const Caption: React.FC<{ text: string; top: number }> = ({ text, top }) => {
  const size = 58;
  const stroke = Math.round((11 / 56) * size);
  return (
    <div style={{ position: "absolute", top, left: 50, right: 50, display: "grid", placeItems: "center" }}>
      <div style={{ position: "relative", fontFamily: "'TikTok Sans', 'Helvetica Neue', 'Apple Color Emoji', sans-serif", fontWeight: 500, fontSize: size, lineHeight: 1.22, textAlign: "center", whiteSpace: "pre-wrap" }}>
        <span style={{ position: "absolute", inset: 0, color: "#000", WebkitTextStroke: `${stroke}px #000`, textShadow: `0 ${Math.round((2 / 56) * size)}px ${Math.round((5 / 56) * size)}px rgba(0,0,0,0.5)` }}>{text}</span>
        <span style={{ position: "relative", color: "#fff" }}>{text}</span>
      </div>
    </div>
  );
};

/** Level-up burst in the HUD's type, on the mat below the hands so it never covers the face. Level colour, INK outline, hard shadow, a flash in the same colour. */
const LevelUp: React.FC<{ level: number; since: number }> = ({ level, since }) => {
  const scale = interpolate(since, [0, 0.18, 1.2, 1.6], [0.4, 1.1, 1, 1.15], { extrapolateRight: "clamp" });
  const opacity = interpolate(since, [0, 0.12, 1.2, 1.6], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const flash = interpolate(since, [0, 0.08, 0.35], [0, 0.4, 0], { extrapolateRight: "clamp" });
  const color = levelColor(level);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: color, opacity: flash }} />
      <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, opacity }}>
        <g transform={`translate(540 1420) scale(${scale}) translate(-540 -1420)`}>
          <GameText x={540} y={1440} size={150} fill={color} outline={11} shadow={12} spacing={2}>LEVEL {level}</GameText>
          <GameText x={540} y={1530} size={62} fill="#fff" outline={7} shadow={6} spacing={3}>SPEED UP!</GameText>
        </g>
      </svg>
    </>
  );
};

const PipePair: React.FC<{ left: number; gapTop: number; gapBottom: number; o: FlappyOptions }> = ({ left, gapTop, gapBottom, o }) => {
  const cap = 60, over = 13;
  const body = `linear-gradient(90deg, ${PIPE.dark} 0%, ${PIPE.light} 22%, ${PIPE.body} 55%, ${PIPE.dark} 100%)`;
  const box = (top: number, height: number, capAtBottom: boolean) => (
    <div style={{ position: "absolute", left, top, width: o.pipeWidth, height }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: capAtBottom ? 0 : cap, bottom: capAtBottom ? cap : 0, background: body, border: `4px solid ${PIPE.rim}`, borderTop: capAtBottom ? undefined : "none", borderBottom: capAtBottom ? "none" : undefined }} />
      <div style={{ position: "absolute", left: -over, right: -over, [capAtBottom ? "bottom" : "top"]: 0, height: cap, background: body, border: `4px solid ${PIPE.rim}`, borderRadius: 6 }} />
    </div>
  );
  return (
    <>
      {box(0, gapTop, true)}
      {box(gapBottom, o.height - gapBottom, false)}
    </>
  );
};

/** Our own bird, drawn in code: round body, one flapping wing, orange beak, white eye. Width sets the size (aspect 140:120). */
const Bird: React.FC<{ width: number; flap: number }> = ({ width, flap }) => {
  const wingRot = [-28, 0, 24][flap];
  return (
    <svg width={width} height={(width * 120) / 140} viewBox="0 0 140 120" style={{ overflow: "visible", display: "block" }}>
      <ellipse cx={66} cy={62} rx={50} ry={40} fill="#F7C948" stroke="#7A5A00" strokeWidth={4} />
      <ellipse cx={58} cy={80} rx={30} ry={16} fill="#FBE29A" />
      <g transform={`rotate(${wingRot} 48 62)`}>
        <ellipse cx={36} cy={62} rx={28} ry={16} fill="#E9A93A" stroke="#7A5A00" strokeWidth={4} />
      </g>
      <circle cx={92} cy={46} r={16} fill="#fff" stroke="#7A5A00" strokeWidth={4} />
      <circle cx={98} cy={47} r={7} fill="#1a1a1a" />
      <path d="M108 60 L138 56 L108 72 Z" fill="#F0662E" stroke="#7A3A12" strokeWidth={3} strokeLinejoin="round" />
      <path d="M108 66 L134 70 L106 78 Z" fill="#D9531F" stroke="#7A3A12" strokeWidth={3} strokeLinejoin="round" />
      <path d="M20 52 L4 40 L14 62 L2 70 L22 70 Z" fill="#E9A93A" stroke="#7A5A00" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
};
