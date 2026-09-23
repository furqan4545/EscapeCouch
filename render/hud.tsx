import { interpolate } from "remotion";
import type { Landmark, MatchConfig, MatchFrame } from "../engine/types";

// Our own look, not Arena's: cyan skeleton with a soft glow, a dark glass header, amber accents.
const C = {
  glass: "rgba(12, 14, 20, 0.78)",
  line: "rgba(255,255,255,0.08)",
  text: "#F4F6FA",
  muted: "#9AA3B2",
  you: "#22D3EE",
  ghost: "#F97316",
  amber: "#FBBF24",
  win: "#34D399",
  lose: "#F87171",
};

const EDGES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28]];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export const Skeleton: React.FC<{ lm: Landmark[] | null }> = ({ lm }) => {
  if (!lm) return null;
  const W = 1080, H = 1920;
  const ok = (k: number) => lm[k][3] > 0.35;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g stroke={C.you} strokeWidth={9} strokeLinecap="round" opacity={0.35} style={{ filter: "blur(6px)" }}>
        {EDGES.filter(([a, b]) => ok(a) && ok(b)).map(([a, b]) => <line key={`g${a}${b}`} x1={lm[a][0] * W} y1={lm[a][1] * H} x2={lm[b][0] * W} y2={lm[b][1] * H} />)}
      </g>
      <g stroke="#E6FDFF" strokeWidth={5} strokeLinecap="round">
        {EDGES.filter(([a, b]) => ok(a) && ok(b)).map(([a, b]) => <line key={`l${a}${b}`} x1={lm[a][0] * W} y1={lm[a][1] * H} x2={lm[b][0] * W} y2={lm[b][1] * H} />)}
      </g>
      {JOINTS.filter(ok).map((k) => <circle key={k} cx={lm[k][0] * W} cy={lm[k][1] * H} r={12} fill={C.you} stroke="#0B1020" strokeWidth={3} />)}
    </svg>
  );
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.ceil(s % 60)).padStart(2, "0")}`;

export const Header: React.FC<{ m: MatchFrame; cfg: MatchConfig }> = ({ m, cfg }) => {
  const knob = (m.bar + 1) / 2; // 0 = pinned to the left (ghost leads by a lot), 1 = pinned right (you lead); your colour fills from the left
  const timeText = m.status === "countdown" ? clock(cfg.durationSec) : clock(m.timeLeft);
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 110, background: C.glass, border: `2px solid ${C.line}`, borderRadius: 34, padding: "26px 34px 30px", color: C.text, backdropFilter: "blur(14px)" }}>
      <div style={{ textAlign: "center", fontSize: 26, letterSpacing: 6, fontWeight: 700, color: C.amber }}>RANKED MATCH</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
        <Player name={cfg.you.name} elo={cfg.you.elo} color={C.you} align="left" />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, color: C.muted, letterSpacing: 3 }}>TIME</div>
          <div style={{ fontSize: 76, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 4, color: m.status === "live" && m.timeLeft <= 10 ? C.lose : C.text }}>{timeText}</div>
        </div>
        <Player name={cfg.ghost.name} elo={cfg.ghost.elo} color={C.ghost} align="right" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 26 }}>
        <div style={{ width: 84, fontSize: 64, fontWeight: 800, color: C.you, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{m.yourReps}</div>
        <div style={{ position: "relative", flex: 1, height: 30, borderRadius: 15, background: `linear-gradient(90deg, ${C.you} 0%, ${C.you} ${knob * 100}%, ${C.ghost} ${knob * 100}%, ${C.ghost} 100%)`, boxShadow: "inset 0 2px 6px rgba(0,0,0,.5)" }}>
          <div style={{ position: "absolute", top: -8, left: `calc(${knob * 100}% - 23px)`, width: 46, height: 46, borderRadius: 23, background: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,.6)" }} />
        </div>
        <div style={{ width: 84, fontSize: 64, fontWeight: 800, color: C.ghost, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{m.ghostReps}</div>
      </div>
    </div>
  );
};

const Player: React.FC<{ name: string; elo: number; color: string; align: "left" | "right" }> = ({ name, elo, color, align }) => (
  <div style={{ display: "flex", flexDirection: align === "left" ? "row" : "row-reverse", alignItems: "center", gap: 16, width: 330 }}>
    <div style={{ width: 96, height: 96, borderRadius: 48, background: `${color}22`, border: `4px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 800, color }}>{name.slice(0, 1).toUpperCase()}</div>
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: 34, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 24, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{elo} ELO</div>
    </div>
  </div>
);

/** Bottom rep counter. The ring fills with push-up depth, so the viewer sees the count arm before it lands. */
export const RepRing: React.FC<{ m: MatchFrame }> = ({ m }) => {
  const r = 118, cx = 150, cy = 150, circ = 2 * Math.PI * r;
  const fill = m.status === "live" || m.status === "over" ? m.depth : 0;
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 150, transform: "translateX(-50%)", width: 300, height: 300 }}>
      <svg width={300} height={300}>
        <circle cx={cx} cy={cy} r={r} fill={C.glass} stroke={C.line} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.amber} strokeWidth={14} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - fill)} transform={`rotate(-90 ${cx} ${cy})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: C.text }}>
        <div style={{ fontSize: 118, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{m.yourReps}</div>
        <div style={{ fontSize: 22, letterSpacing: 4, color: C.muted, marginTop: 6 }}>REPS</div>
      </div>
    </div>
  );
};

export const Countdown: React.FC<{ secondsLeft: number }> = ({ secondsLeft }) => {
  if (secondsLeft > 3 || secondsLeft <= 0) return null; // the lead-in second before "3" shows nothing
  const n = Math.ceil(secondsLeft);
  const frac = n - secondsLeft; // 0 at the start of this second, 1 at the end
  const scale = interpolate(frac, [0, 0.25, 1], [1.4, 1, 0.9]);
  const opacity = interpolate(frac, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 360, fontWeight: 900, color: C.amber, textShadow: "0 8px 40px rgba(0,0,0,.7)", transform: `scale(${scale})`, opacity }}>{n}</div>
    </div>
  );
};

export const ResultCard: React.FC<{ result: { yourReps: number; ghostReps: number; winner: "you" | "ghost" | "draw" }; cfg: MatchConfig; sinceSec: number; fps: number }> = ({ result, cfg, sinceSec }) => {
  const won = result.winner === "you";
  const t = Math.min(1, sinceSec / 0.35);
  const scale = interpolate(t, [0, 1], [0.8, 1]);
  const eloDelta = won ? 24 : result.winner === "draw" ? 0 : -19;
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: t }}>
      <div style={{ transform: `scale(${scale})`, background: C.glass, border: `3px solid ${won ? C.win : C.lose}`, borderRadius: 40, padding: "54px 70px", textAlign: "center", color: C.text, minWidth: 720 }}>
        <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: 4, color: won ? C.win : result.winner === "draw" ? C.amber : C.lose }}>{won ? "VICTORY" : result.winner === "draw" ? "DRAW" : "DEFEAT"}</div>
        <div style={{ fontSize: 44, marginTop: 18, fontVariantNumeric: "tabular-nums" }}><span style={{ color: C.you }}>{result.yourReps}</span> <span style={{ color: C.muted }}>vs</span> <span style={{ color: C.ghost }}>{result.ghostReps}</span></div>
        <div style={{ fontSize: 30, color: C.muted, marginTop: 10 }}>{cfg.you.name} {cfg.you.elo} → <span style={{ color: won ? C.win : C.lose, fontWeight: 700 }}>{cfg.you.elo + eloDelta}</span> ELO</div>
      </div>
    </div>
  );
};
