// Game art, ported from render/FlappyVideo.tsx so the app looks like the video: our own bird,
// salmon pipes, the right-hand player panel (x >= 820, where the face never goes) and the
// level-up burst on the mat below the hands. All in 1080-wide world units.

import { Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, Rect, Stop, Text } from 'react-native-svg';
import { eloGain, lapElo } from '../../engine/flappy';
import { APP_ELO, LIVE } from './game';

export const FONT = 'LilitaOne';
export const INK = '#2B160E';
export const CREAM = '#FFE7C2';
const PIPE = { body: '#E98B71', light: '#F4A98F', dark: '#C4664C', rim: '#8E432E' };
const LEVEL_COLORS = ['#FFC53D', '#35E0CF', '#FF6FA8', '#A98CFF', '#FF5B4E'];
export const levelColor = (level: number) => LEVEL_COLORS[(Math.max(1, level) - 1) % LEVEL_COLORS.length];
const lighten = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Outlined game text: hard INK shadow, INK outline, then the fill on top. */
export function GameText({ x, y, size, fill, outline, shadow = 0, anchor = 'middle', spacing = 0, opacity = 1, children }: { x: number; y: number; size: number; fill: string; outline: number; shadow?: number; anchor?: 'start' | 'middle' | 'end'; spacing?: number; opacity?: number; children: React.ReactNode }) {
  const common = { x, textAnchor: anchor, fontFamily: FONT, fontSize: size, letterSpacing: spacing, opacity };
  return (
    <>
      {shadow > 0 && <Text {...common} y={y + shadow} fill={INK} stroke={INK} strokeWidth={outline * 2} strokeLinejoin="round">{children}</Text>}
      <Text {...common} y={y} fill={INK} stroke={INK} strokeWidth={outline * 2} strokeLinejoin="round">{children}</Text>
      <Text {...common} y={y} fill={fill}>{children}</Text>
    </>
  );
}

export function PipeDefs() {
  return (
    <Defs>
      <LinearGradient id="pipe" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={PIPE.dark} />
        <Stop offset="0.22" stopColor={PIPE.light} />
        <Stop offset="0.55" stopColor={PIPE.body} />
        <Stop offset="1" stopColor={PIPE.dark} />
      </LinearGradient>
    </Defs>
  );
}

export function PipePair({ left, gapTop, gapBottom, worldH, hit }: { left: number; gapTop: number; gapBottom: number; worldH: number; hit: boolean }) {
  const cap = 60, over = 13, w = LIVE.pipeWidth;
  const opacity = hit ? 0.55 : 1;
  return (
    <G opacity={opacity}>
      <Rect x={left} y={-10} width={w} height={Math.max(0, gapTop - cap + 10)} fill="url(#pipe)" stroke={PIPE.rim} strokeWidth={4} />
      <Rect x={left - over} y={gapTop - cap} width={w + over * 2} height={cap} rx={6} fill="url(#pipe)" stroke={PIPE.rim} strokeWidth={4} />
      <Rect x={left} y={gapBottom + cap} width={w} height={Math.max(0, worldH - gapBottom - cap + 10)} fill="url(#pipe)" stroke={PIPE.rim} strokeWidth={4} />
      <Rect x={left - over} y={gapBottom} width={w + over * 2} height={cap} rx={6} fill="url(#pipe)" stroke={PIPE.rim} strokeWidth={4} />
    </G>
  );
}

/** Blink every 5 s (owner, 23 Sep): 0 = eye open, 1 = shut, over a quarter second. */
export const blinkAt = (sec: number) => {
  const p = (sec % 5) - 4.75;
  return p > 0 ? Math.sin((Math.PI * p) / 0.25) : 0;
};

/** Our own bird: round body, one flapping wing, orange beak, white eye that blinks. Drawn in a 140x120 box. */
export function Bird({ x, y, width, flap, blink = 0, tilt = 0 }: { x: number; y: number; width: number; flap: number; blink?: number; tilt?: number }) {
  const open = 1 - blink;
  const s = width / 140;
  const wingRot = [-28, 0, 24][flap];
  return (
    <G transform={`translate(${x} ${y}) rotate(${tilt}) scale(${s}) translate(-70 -60)`}>
      <Ellipse cx={66} cy={62} rx={50} ry={40} fill="#F7C948" stroke="#7A5A00" strokeWidth={4} />
      <Ellipse cx={58} cy={80} rx={30} ry={16} fill="#FBE29A" />
      <G transform={`rotate(${wingRot} 48 62)`}>
        <Ellipse cx={36} cy={62} rx={28} ry={16} fill="#E9A93A" stroke="#7A5A00" strokeWidth={4} />
      </G>
      {open > 0.15 ? (
        <>
          <Ellipse cx={92} cy={46} rx={16} ry={16 * open} fill="#fff" stroke="#7A5A00" strokeWidth={4} />
          <Ellipse cx={98} cy={47} rx={7} ry={7 * open} fill="#1a1a1a" />
        </>
      ) : (
        <Path d="M76 47 Q92 55 108 47" fill="none" stroke="#7A5A00" strokeWidth={5} strokeLinecap="round" />
      )}
      <Path d="M108 60 L138 56 L108 72 Z" fill="#F0662E" stroke="#7A3A12" strokeWidth={3} strokeLinejoin="round" />
      <Path d="M108 66 L134 70 L106 78 Z" fill="#D9531F" stroke="#7A3A12" strokeWidth={3} strokeLinejoin="round" />
      <Path d="M20 52 L4 40 L14 62 L2 70 L22 70 Z" fill="#E9A93A" stroke="#7A5A00" strokeWidth={3} strokeLinejoin="round" />
    </G>
  );
}

// Player panel geometry, same as the video (1080 wide): the face and the bird never reach x >= 820.
export const PANEL_CX = 940;
export const AVATAR_CY = 262, AVATAR_D = 120;
const NAME_Y = 370, ELO_Y = 412, SCORE_LABEL_Y = 452, SCORE_Y = 538;
const RAIL_X0 = 835, RAIL_X1 = 1045, RAIL_CY = 576, RAIL_H = 12;
const LIVES_Y = 622, REPS_Y = 680, TIME_Y = 730;

const HEART = 'M0 9 C-16 -2 -10 -16 0 -7 C10 -16 16 -2 0 9 Z';

const hexPoints = (cx: number, cy: number, r: number) =>
  [-90, -30, 30, 90, 150, 210].map((a) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)},${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`).join(' ');

/** The SVG part of the panel; the avatar photo is a native Image placed by App at AVATAR_CY. */
export function PlayerPanel({ name, startElo, score, level, laps, lives, maxLives, reps, timeLeft, sincePass, sinceLevel, flap, blink }: { name: string; startElo: number; score: number; level: number; laps: number; lives: number; maxLives: number; reps: number; timeLeft: number; sincePass: number; sinceLevel: number; flap: number; blink: number }) {
  const levelEvery = LIVE.levelEvery;
  const justLeveled = laps > 0 && sinceLevel < 0.5;
  const color = levelColor(level);
  const bounce = 1 + 0.14 * Math.max(0, 1 - sincePass / 0.22);
  const lastGain = laps > 0 ? lapElo(laps, APP_ELO) : 0;
  const eloTarget = startElo + eloGain(laps, APP_ELO);
  const eloShown = laps > 0 && sinceLevel < 0.6 ? Math.round(eloTarget - lastGain * (1 - Math.min(1, sinceLevel / 0.6))) : eloTarget;
  const steps = score % levelEvery;
  const tween = Math.min(1, sincePass / 0.18);
  const shown = justLeveled ? levelEvery : steps > 0 ? steps - 1 + (1 - Math.pow(1 - tween, 3)) : 0;
  const railColor = justLeveled ? levelColor(level - 1) : color;
  const clock = `${Math.floor(timeLeft / 60)}:${String(Math.floor(timeLeft % 60)).padStart(2, '0')}`;
  const railW = RAIL_X1 - RAIL_X0;
  const fillW = (shown / levelEvery) * railW;
  const gemScale = laps > 0 ? 1 + 0.35 * Math.max(0, 1 - sinceLevel / 0.35) : 1;

  return (
    <G>
      <Defs>
        <LinearGradient id="gem" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lighten(color, 0.45)} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
        <LinearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lighten(railColor, 0.35)} />
          <Stop offset="1" stopColor={railColor} />
        </LinearGradient>
      </Defs>

      {/* Ring around the avatar photo, in the level colour */}
      <Circle cx={PANEL_CX} cy={AVATAR_CY + 8} r={AVATAR_D / 2 + 5} fill={INK} />
      <Circle cx={PANEL_CX} cy={AVATAR_CY} r={AVATAR_D / 2 + 5} fill={INK} />
      <Circle cx={PANEL_CX} cy={AVATAR_CY} r={AVATAR_D / 2 - 3.5} fill="none" stroke={color} strokeWidth={7} />

      <G transform={`translate(${PANEL_CX + 46} ${AVATAR_CY + 46}) scale(${gemScale})`}>
        <Polygon points={hexPoints(0, 5, 30)} fill={INK} />
        <Polygon points={hexPoints(0, 0, 30)} fill="url(#gem)" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <GameText x={0} y={11} size={30} fill="#fff" outline={5}>{level}</GameText>
      </G>

      <GameText x={PANEL_CX} y={NAME_Y} size={34} fill="#fff" outline={6} shadow={4}>{name}</GameText>
      <GameText x={PANEL_CX} y={ELO_Y} size={34} fill="#fff" outline={6} shadow={4}>{`ELO ${eloShown}`}</GameText>
      {laps > 0 && sinceLevel < 1 && (
        <GameText x={PANEL_CX - 78} y={ELO_Y - 40 * Math.min(1, sinceLevel)} size={30} fill="#7CFF9B" outline={5} anchor="end" opacity={1 - Math.min(1, sinceLevel)}>{`+${lastGain}`}</GameText>
      )}

      <GameText x={PANEL_CX} y={SCORE_LABEL_Y} size={20} fill={CREAM} outline={4} spacing={4}>SCORE</GameText>
      <G transform={`translate(${PANEL_CX} ${SCORE_Y - 36}) scale(${bounce}) translate(${-PANEL_CX} ${-(SCORE_Y - 36)})`}>
        <GameText x={PANEL_CX} y={SCORE_Y} size={100} fill="#fff" outline={8} shadow={7}>{score}</GameText>
      </G>

      <Rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2 + 4} width={railW} height={RAIL_H} rx={RAIL_H / 2} fill={INK} opacity={0.9} />
      <Rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2} width={railW} height={RAIL_H} rx={RAIL_H / 2} fill="rgba(43, 22, 14, 0.45)" stroke="#fff" strokeOpacity={0.92} strokeWidth={3} />
      {fillW > 1 && <Rect x={RAIL_X0} y={RAIL_CY - RAIL_H / 2} width={Math.max(RAIL_H, fillW)} height={RAIL_H} rx={RAIL_H / 2} fill="url(#rail)" stroke={INK} strokeWidth={3} />}
      {Array.from({ length: levelEvery - 1 }, (_, k) => k + 1).filter((k) => k > shown + 0.3).map((k) => (
        <Circle key={k} cx={RAIL_X0 + (k / levelEvery) * railW} cy={RAIL_CY} r={2.2} fill="#fff" opacity={0.85} />
      ))}
      <Bird x={RAIL_X0 + fillW} y={RAIL_CY - 5 - (justLeveled ? 8 * Math.sin((sinceLevel / 0.5) * Math.PI) : 0)} width={46} flap={flap} blink={blink} />

      {Array.from({ length: maxLives }, (_, k) => (
        <G key={k} transform={`translate(${PANEL_CX + (k - (maxLives - 1) / 2) * (maxLives > 3 ? 40 : 46)} ${LIVES_Y}) scale(${maxLives > 3 ? 1 : 1.25})`}>
          <Path d={HEART} fill={INK} transform="translate(0 3)" />
          <Path d={HEART} fill={k < lives ? '#FF5B4E' : 'rgba(43, 22, 14, 0.45)'} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </G>
      ))}

      <GameText x={PANEL_CX} y={REPS_Y} size={30} fill={CREAM} outline={5} shadow={3}>{`REPS ${reps}`}</GameText>
      <GameText x={PANEL_CX} y={TIME_Y} size={40} fill={timeLeft < 10 ? '#FF5B4E' : '#fff'} outline={6} shadow={4}>{clock}</GameText>
    </G>
  );
}

/** Level-up burst on the mat below the hands, in the level colour, with a flash. */
export function LevelUp({ level, since, worldH }: { level: number; since: number; worldH: number }) {
  if (since < 0 || since > 1.6) return null;
  const cy = worldH * 0.74;
  const scale = since < 0.18 ? 0.4 + (0.7 * since) / 0.18 : since < 1.2 ? 1.1 - (0.1 * (since - 0.18)) / 1.02 : 1 + (0.15 * (since - 1.2)) / 0.4;
  const opacity = since < 0.12 ? since / 0.12 : since < 1.2 ? 1 : 1 - (since - 1.2) / 0.4;
  const flash = since < 0.08 ? (0.4 * since) / 0.08 : since < 0.35 ? 0.4 * (1 - (since - 0.08) / 0.27) : 0;
  const color = levelColor(level);
  return (
    <G>
      <Rect x={0} y={0} width={1080} height={worldH} fill={color} opacity={clamp01(flash)} />
      <G opacity={clamp01(opacity)} transform={`translate(540 ${cy}) scale(${scale}) translate(-540 ${-cy})`}>
        <GameText x={540} y={cy + 20} size={150} fill={color} outline={11} shadow={12} spacing={2}>{`LEVEL ${level}`}</GameText>
        <GameText x={540} y={cy + 110} size={62} fill="#fff" outline={7} shadow={6} spacing={3}>SPEED UP!</GameText>
      </G>
    </G>
  );
}
