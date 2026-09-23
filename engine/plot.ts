/**
 * Elbow-angle trace with rep markers, as a PNG, so threshold tuning is done by eye.
 *
 *   npx tsx engine/plot.ts engine/out/take1.reps.json engine/out/take1.plot.png
 *
 * Draws the smoothed elbow angle over time, the down/up thresholds, and a tick at every credited
 * rep (label = depth in degrees). Rendered by a Playwright page screenshot; no image library.
 */
import { readFileSync, writeFileSync } from "fs";
import { chromium } from "playwright";
import type { FrameState, RepEvent } from "./types";

const [inArg, outArg] = process.argv.slice(2);
if (!inArg || !outArg) {
  console.error("usage: npx tsx engine/plot.ts <reps.json> <out.png>");
  process.exit(1);
}
const data = JSON.parse(readFileSync(inArg, "utf8")) as { options: { downDeg: number; upDeg: number }; reps: RepEvent[]; states: FrameState[] };
const W = 1600, H = 420, L = 50, R = 20, T = 20, B = 40;
const tMax = data.states[data.states.length - 1].t;
const x = (t: number) => L + (t / tMax) * (W - L - R);
const y = (deg: number) => T + ((180 - deg) / 180) * (H - T - B);
const path = data.states.map((s, k) => `${k ? "L" : "M"}${x(s.t).toFixed(1)},${y(s.elbowDeg).toFixed(1)}`).join(" ");
const ticks = Array.from({ length: Math.floor(tMax / 5) + 1 }, (_, k) => k * 5);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#fff;font-family:sans-serif">
${[180, 150, 120, 90, 60, 30].map((d) => `<line x1="${L}" x2="${W - R}" y1="${y(d)}" y2="${y(d)}" stroke="#eee"/><text x="4" y="${y(d) + 4}" font-size="12" fill="#666">${d}°</text>`).join("")}
${ticks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${T}" y2="${H - B}" stroke="#f3f3f3"/><text x="${x(t)}" y="${H - B + 16}" font-size="11" fill="#666" text-anchor="middle">${t}s</text>`).join("")}
<line x1="${L}" x2="${W - R}" y1="${y(data.options.downDeg)}" y2="${y(data.options.downDeg)}" stroke="#d33" stroke-dasharray="6 4"/><text x="${W - R}" y="${y(data.options.downDeg) - 4}" font-size="11" fill="#d33" text-anchor="end">down &lt; ${data.options.downDeg}°</text>
<line x1="${L}" x2="${W - R}" y1="${y(data.options.upDeg)}" y2="${y(data.options.upDeg)}" stroke="#393" stroke-dasharray="6 4"/><text x="${W - R}" y="${y(data.options.upDeg) - 4}" font-size="11" fill="#393" text-anchor="end">up &gt; ${data.options.upDeg}°</text>
<path d="${path}" fill="none" stroke="#1a56db" stroke-width="1.5"/>
${data.reps.map((r, k) => `<line x1="${x(r.t)}" x2="${x(r.t)}" y1="${T}" y2="${H - B}" stroke="#f90" stroke-width="1"/><text x="${x(r.t)}" y="${T + 12 + (k % 2) * 14}" font-size="11" fill="#c60" text-anchor="middle">#${k + 1} ${r.depthDeg}°</text>`).join("")}
<text x="${L}" y="${H - 6}" font-size="12" fill="#333">${data.reps.length} reps credited · blue = smoothed elbow angle · orange = rep credited (label: depth)</text>
</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<body style="margin:0">${svg}</body>`);
writeFileSync(outArg, await page.screenshot({ type: "png" }));
await browser.close();
console.log(`wrote ${outArg}`);
