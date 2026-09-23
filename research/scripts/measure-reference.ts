// Measures the reference Flappy push-up video: pipe scroll speed, spacing, body width and vertical gap.
// Streams raw RGB frames from ffmpeg; no image libraries.
//   npx tsx research/scripts/measure-reference.ts research/evidence/gamified-reference/reference.mp4 sample 10
//   npx tsx research/scripts/measure-reference.ts research/evidence/gamified-reference/reference.mp4 measure
import { spawn } from "child_process";

const [video, mode, arg] = process.argv.slice(2);
const W = 720, H = 1280, FPS = 30, FRAME = W * H * 3;

function frames(onFrame: (buf: Buffer, i: number) => void, ss = 0, t?: number): Promise<void> {
  return new Promise((res, rej) => {
    const args = ["-v", "error", "-ss", String(ss), "-i", video, ...(t ? ["-t", String(t)] : []), "-vf", `fps=${FPS}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"];
    const p = spawn("ffmpeg", args);
    let pending = Buffer.alloc(0), i = 0;
    p.stdout.on("data", (d: Buffer) => {
      pending = Buffer.concat([pending, d]);
      while (pending.length >= FRAME) { onFrame(pending.subarray(0, FRAME), i++); pending = pending.subarray(FRAME); }
    });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c))));
  });
}

const px = (b: Buffer, x: number, y: number) => { const o = (y * W + x) * 3; return [b[o], b[o + 1], b[o + 2]]; };
// Salmon/copper pipe body, tuned from the sample profile.
const isPipe = (r: number, g: number, b: number) => r > 125 && r - g > 38 && r - b > 55 && g > 60 && g < 185 && b > 30 && b < 160;

if (mode === "sample") {
  frames((b) => {
    const row = 30;
    const out: string[] = [];
    for (let x = 0; x < W; x += 12) { const [r, g, bb] = px(b, x, row); out.push(`${x}:${r},${g},${bb}${isPipe(r, g, bb) ? "*" : ""}`); }
    console.log(out.join("  "));
  }, Number(arg || 10), 1 / FPS).then(() => {});
} else {
  type Run = { c: number; w: number; gap: number | null };
  const all: { t: number; runs: Run[] }[] = [];
  frames((b, i) => {
    const pipeCol: boolean[] = [];
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let y = 6; y < 70; y++) { const [r, g, bb] = px(b, x, y); if (isPipe(r, g, bb)) n++; }
      pipeCol.push(n / 64 > 0.6);
    }
    const runs: Run[] = [];
    for (let x = 0; x < W; ) {
      if (!pipeCol[x]) { x++; continue; }
      let e = x; while (e < W && pipeCol[e]) e++;
      const w = e - x;
      if (w >= 18 && x > 0 && e < W) {
        const c = Math.round((x + e) / 2);
        // vertical gap at the body centre: tolerate short non-pipe runs (outlines, highlights)
        const scan = (from: number, dir: 1 | -1) => { let y = from, miss = 0, last = from; while (y >= 0 && y < H) { const [r, g, bb] = px(b, c, y); if (isPipe(r, g, bb)) { miss = 0; last = y; } else if (++miss > 12) break; y += dir; } return last; };
        const topEnd = scan(0, 1), bottomStart = scan(H - 1, -1);
        const gap = bottomStart - topEnd;
        runs.push({ c, w, gap: gap > 60 && gap < H - 200 ? gap : null });
      }
      x = e;
    }
    all.push({ t: i / FPS, runs });
  }).then(() => {
    const med = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const perSec = new Map<number, { v: number[]; sp: number[]; w: number[]; gap: number[] }>();
    for (let k = 1; k < all.length; k++) {
      const sec = Math.floor(all[k].t);
      const bucket = perSec.get(sec) ?? { v: [], sp: [], w: [], gap: [] };
      for (const r of all[k].runs) {
        const prev = all[k - 1].runs.map((p) => p.c - r.c).filter((d) => d >= 0 && d <= 90);
        if (prev.length) bucket.v.push(Math.min(...prev));
        bucket.w.push(r.w);
        if (r.gap) bucket.gap.push(r.gap);
      }
      const cs = all[k].runs.map((r) => r.c).sort((a, b) => a - b);
      for (let j = 1; j < cs.length; j++) bucket.sp.push(cs[j] - cs[j - 1]);
      perSec.set(sec, bucket);
    }
    console.log("sec | speed px/frame | speed px/s @720 | spacing px @720 | body w | gap px @1280 | pipes seen");
    const allV: number[] = [], allSp: number[] = [], allW: number[] = [], allG: number[] = [];
    for (const [sec, b] of [...perSec.entries()].sort((a, b) => a[0] - b[0])) {
      const v = med(b.v);
      allV.push(...b.v); allSp.push(...b.sp); allW.push(...b.w); allG.push(...b.gap);
      console.log(`${String(sec).padStart(3)} | ${v.toFixed(1).padStart(5)} | ${(v * FPS).toFixed(0).padStart(5)} | ${String(med(b.sp)).padStart(5)} | ${String(med(b.w)).padStart(4)} | ${String(med(b.gap)).padStart(5)} | ${b.w.length}`);
    }
    const v = med(allV), sp = med(allSp), w = med(allW), g = med(allG);
    console.log(`\nOVERALL @720x1280: speed ${v} px/frame = ${v * FPS} px/s · spacing ${sp} px · body ${w} px · gap ${g} px`);
    console.log(`SCALED @1080x1920 (x1.5): speed ${Math.round(v * FPS * 1.5)} px/s · spacing ${Math.round(sp * 1.5)} px · body ${Math.round(w * 1.5)} px · gap ${Math.round(g * 1.5)} px · a pipe every ${(sp / (v * FPS)).toFixed(2)} s`);
  });
}
