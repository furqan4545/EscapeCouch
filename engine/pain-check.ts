/**
 * Pain-trigger check for a take: prints the smoothed PSPI distribution and the boom moments, and
 * writes a face-crop sheet (booms vs the calmest moments) and a plot, so the trigger can be judged
 * by eye before rendering.
 *
 *   npx tsx engine/pain-check.ts take1 [oldBoomSec,...]
 *   → engine/out/<take>.pain_faces.jpg, engine/out/<take>.pain_plot.png
 */
import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { chromium } from "playwright";
import { giveUpAt } from "./flappy";
import { DEFAULT_PAIN, painMoments, painTrack, type FaceFile } from "./pain";

const take = process.argv[2] || "take1";
const old = (process.argv[3] || "").split(",").filter(Boolean).map(Number);
const root = "./";
const out = `engine/out/${take}.pain/`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const face: FaceFile = JSON.parse(readFileSync(`pose/out/${take}.face.json`, "utf8"));
const lm = JSON.parse(readFileSync(`pose/out/${take}.landmarks.json`, "utf8"));
const reps = JSON.parse(readFileSync(`engine/out/${take}.reps.json`, "utf8")).reps;
const startT = Math.max(0, reps[0].t - 2.5), endT = giveUpAt(lm.frames, reps)!;
const track = painTrack(face).filter((s) => s.t >= startT && s.t <= endT);
const vals = track.map((s) => s.smooth).filter((v): v is number => v !== null).sort((a, b) => a - b);
const q = (p: number) => vals[Math.floor(p * (vals.length - 1))];
console.log(`window ${startT.toFixed(2)}-${endT.toFixed(2)}s · face found ${track.filter((s) => s.score !== null).length}/${track.length} frames`);
console.log(`smoothed grimace: min ${q(0).toFixed(2)} · p25 ${q(0.25).toFixed(2)} · median ${q(0.5).toFixed(2)} · p75 ${q(0.75).toFixed(2)} · p90 ${q(0.9).toFixed(2)} · p97 ${q(0.97).toFixed(2)} · max ${q(1).toFixed(2)}`);
const booms = painMoments(face, startT + 1, endT - 0.8);
console.log(`pain booms: ${booms.map((b) => `${b.t}s hold ${b.hold}s peak ${b.peak.toFixed(2)}s +${b.strength}`).join(" · ") || "none"}  [minExcess ${DEFAULT_PAIN.minExcess} over median ${q(0.5).toFixed(2)}]`);
const at = (t: number) => track.reduce((b, s) => (Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b));
if (old.length) console.log("comparison moments → smoothed grimace there:", old.map((t) => `${t}s: ${at(t).smooth?.toFixed(2)}`).join(" · "));
// per-second strip of the smoothed score
let strip = "";
for (let t = Math.ceil(startT); t <= endT; t++) strip += `${t}:${(at(t).smooth ?? 0).toFixed(1)} `;
console.log(strip);

// face crops: peaks (+ lead) vs calm frames (lowest smoothed scores, spread out)
const cropAt = (t: number, file: string, label: string) => {
  const f = face.frames[Math.round(t * face.fps)];
  const b = f?.box ?? [0.3, 0.15, 0.55, 0.35];
  const W = 1080, H = 1920, cx = ((b[0] + b[2]) / 2) * W, cy = ((b[1] + b[3]) / 2) * H, side = Math.max(260, Math.max((b[2] - b[0]) * W, (b[3] - b[1]) * H) * 1.5);
  const x = Math.max(0, Math.min(W - side, cx - side / 2)), y = Math.max(0, Math.min(H - side, cy - side / 2));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", `clips/${take}_30fps.mp4`, "-frames:v", "1", "-vf", `crop=${Math.round(side)}:${Math.round(side)}:${Math.round(x)}:${Math.round(y)},scale=240:240,drawtext=text='${label}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.65`, "-q:v", "3", out + file]);
};
booms.forEach((b, k) => cropAt(b.peak, `a_boom${k}.jpg`, `BOOM ${b.peak.toFixed(1)}s ${at(b.peak).smooth?.toFixed(2)}`));
old.forEach((t, k) => cropAt(t + 0.15, `b_old${k}.jpg`, `OLD ${t}s ${at(t).smooth?.toFixed(2)}`));
const calm = [...track].filter((s) => s.smooth !== null).sort((a, b) => a.smooth! - b.smooth!);
const calmPicked: number[] = [];
for (const s of calm) { if (calmPicked.every((t) => Math.abs(t - s.t) > 5)) calmPicked.push(s.t); if (calmPicked.length >= 4) break; }
calmPicked.forEach((t, k) => cropAt(t, `c_calm${k}.jpg`, `CALM ${t.toFixed(1)}s ${at(t).smooth?.toFixed(2)}`));
execFileSync("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", out + "*.jpg", "-vf", `tile=${booms.length + old.length + calmPicked.length}x1:padding=4:color=0x121212`, "-frames:v", "1", "-q:v", "3", `engine/out/${take}.pain_faces.jpg`]);
console.log(`faces sheet: ${booms.length} booms, ${old.length} old, ${calmPicked.length} calm`);

// plot
const Wp = 1600, Hp = 360, L = 40, R = 16, T = 16, B = 34;
const maxY = Math.max(1.2, q(1) + 0.1);
const x = (t: number) => L + ((t - startT) / (endT - startT)) * (Wp - L - R);
const y = (v: number) => T + (1 - v / maxY) * (Hp - T - B);
const pts = track.filter((s) => s.smooth !== null).map((s, k) => `${k ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.smooth!).toFixed(1)}`).join(" ");
const med = q(0.5);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wp}" height="${Hp}" style="background:#fff;font-family:sans-serif">
${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${L}" x2="${Wp - R}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="6" y="${y(v) + 4}" font-size="11" fill="#666">${v}</text>`).join("")}
<line x1="${L}" x2="${Wp - R}" y1="${y(med)}" y2="${y(med)}" stroke="#999" stroke-dasharray="4 4"/><text x="${Wp - R}" y="${y(med) - 4}" font-size="11" fill="#666" text-anchor="end">median ${med.toFixed(2)}</text>
<line x1="${L}" x2="${Wp - R}" y1="${y(med + DEFAULT_PAIN.minExcess)}" y2="${y(med + DEFAULT_PAIN.minExcess)}" stroke="#d33" stroke-dasharray="6 4"/><text x="${Wp - R}" y="${y(med + DEFAULT_PAIN.minExcess) - 4}" font-size="11" fill="#d33" text-anchor="end">boom threshold</text>
<path d="${pts}" fill="none" stroke="#1a56db" stroke-width="1.6"/>
${booms.map((m) => m.t).map((b) => `<line x1="${x(b)}" x2="${x(b)}" y1="${T}" y2="${Hp - B}" stroke="#e11" stroke-width="2"/><text x="${x(b) + 3}" y="${T + 12}" font-size="11" fill="#e11">BOOM ${b.toFixed(1)}s</text>`).join("")}
${old.map((b) => `<line x1="${x(b)}" x2="${x(b)}" y1="${T + 20}" y2="${Hp - B}" stroke="#999" stroke-width="1" stroke-dasharray="3 3"/><text x="${x(b) + 3}" y="${Hp - B - 6}" font-size="11" fill="#777">old ${b}s</text>`).join("")}
${reps.filter((r: any) => r.t >= startT && r.t <= endT).map((r: any) => `<circle cx="${x(r.t)}" cy="${Hp - B + 8}" r="4" fill="#f90"/>`).join("")}
${Array.from({ length: Math.floor(endT - startT) + 1 }, (_, k) => Math.ceil(startT) + k).filter((t) => t % 5 === 0).map((t) => `<text x="${x(t)}" y="${Hp - 4}" font-size="11" fill="#666" text-anchor="middle">${t}s</text>`).join("")}
</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Wp, height: Hp } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
writeFileSync(`engine/out/${take}.pain_plot.png`, await page.screenshot({ type: "png" }));
await browser.close();
console.log("plot written");
