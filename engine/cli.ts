/**
 * Engine check over a landmarks file: prints the reps it found, then simulates a match against
 * an authored ghost and writes both to engine/out/.
 *
 *   npx tsx engine/cli.ts pose/out/take1.landmarks.json
 *   # optional: DOWN=105 UP=150 SMOOTH=0.5 DURATION=60 START=auto GHOST_REPS=34 PACING=gas-out
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { authoredGhost } from "./ghost";
import { COUNTDOWN_SEC, simulateMatch, suggestStart } from "./match";
import { detectReps } from "./reps";
import type { PoseFile } from "./types";

const file = process.argv[2];
if (!file) {
  console.error("usage: npx tsx engine/cli.ts <landmarks.json>");
  process.exit(1);
}
const pose: PoseFile = JSON.parse(readFileSync(file, "utf8"));
const opts = { downDeg: Number(process.env.DOWN || 95), upDeg: Number(process.env.UP || 150), smoothing: Number(process.env.SMOOTH || 0.5) };
const { states, reps } = detectReps(pose.frames, opts);

const tracked = states.filter((s) => s.tracked).length;
console.log(`${basename(file)} · ${pose.frames.length} frames @ ${pose.fps}fps · tracked ${Math.round((100 * tracked) / pose.frames.length)}% · thresholds down<${opts.downDeg}° up>${opts.upDeg}°`);
console.log(`${reps.length} reps`);
console.table(reps.map((r, k) => ({ rep: k + 1, at: r.t.toFixed(2) + "s", gap: k ? (r.t - reps[k - 1].t).toFixed(2) + "s" : "", depth: r.depthDeg + "°", dur: r.durationSec + "s" })));

const durationSec = Number(process.env.DURATION || 60);
const startT = process.env.START && process.env.START !== "auto" ? Number(process.env.START) : suggestStart(reps) + COUNTDOWN_SEC;
const ghost = authoredGhost({ name: process.env.GHOST_NAME || "Pedro", elo: Number(process.env.GHOST_ELO || 4024), totalReps: Number(process.env.GHOST_REPS || Math.max(1, reps.length - 3)), durationSec, pacing: (process.env.PACING as any) || "gas-out", seed: 7 });
const match = simulateMatch(states, reps, { durationSec, startT, fps: pose.fps, you: { name: "You", elo: 1247 }, ghost });
console.log(`match: clock starts at ${startT.toFixed(2)}s of the clip, ${durationSec}s long · you ${match.yourReps} vs ${ghost.name} ${match.ghostReps} → ${match.winner === "you" ? "you win" : match.winner === "ghost" ? `${ghost.name} wins` : "draw"}`);
const live = match.frames.filter((f) => f.status === "live");
const samples = [0, 0.25, 0.5, 0.75, 1].map((p) => live[Math.min(live.length - 1, Math.floor(p * (live.length - 1)))]).filter(Boolean);
console.table(samples.map((f) => ({ clock: f.clock, timeLeft: f.timeLeft, you: f.yourReps, ghost: f.ghostReps, bar: f.bar, phase: f.phase })));

const outDir = join("engine", "out");
mkdirSync(outDir, { recursive: true });
const stem = basename(file).replace(/\.landmarks\.json$/, "");
writeFileSync(join(outDir, `${stem}.reps.json`), JSON.stringify({ source: file, options: opts, reps, states }, null, 0));
writeFileSync(join(outDir, `${stem}.match.json`), JSON.stringify({ config: { durationSec, startT, fps: pose.fps, you: { name: "You", elo: 1247 }, ghost }, result: { yourReps: match.yourReps, ghostReps: match.ghostReps, winner: match.winner }, frames: match.frames }, null, 0));
console.log(`wrote ${outDir}/${stem}.reps.json and ${stem}.match.json`);
