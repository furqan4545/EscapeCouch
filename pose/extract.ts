/**
 * Pose + face pass, TypeScript: video in, per-frame body landmarks and facial blendshapes out.
 *
 *   npx tsx pose/extract.ts public/IMG_0889.MOV pose/out/take1.landmarks.json
 *   # optional: TASKS=pose,face FPS=30 SCALE=0.5 FACE_SCALE=1 DEBUG_EVERY=90 DELEGATE=GPU|CPU CHANNEL=chrome HEADLESS=0
 *
 * How: ffmpeg makes an intra-only 30 fps proxy (every frame a keyframe, so seeking is exact and
 * instant). A throwaway HTTP server on 127.0.0.1 serves one page plus the tasks-vision bundle,
 * its wasm, the model and the proxy (with byte ranges, streamed from disk: pushing the video
 * through Playwright's request interception instead crashes Chrome). Playwright opens Chrome on
 * that page; the page loads @mediapipe/tasks-vision, seeks the proxy one frame at a time, draws
 * the frame at SCALE into a canvas and runs PoseLandmarker in VIDEO mode. Landmarks are
 * normalized 0..1, so SCALE only affects speed. The face task runs FaceLandmarker on the same
 * frame at FACE_SCALE (full size by default: the blendshapes need the face as sharp as possible)
 * and keeps the 52 blendshape scores (browDownLeft, eyeSquintRight, noseSneerLeft, ...) that
 * engine/pain.ts turns into a pain score.
 *
 * Output schema is what engine/ reads: { video, fps, width, height, frames: [{ i, t, ok, lm }] }
 * with lm = 33 x [x, y, z, visibility, presence].
 *
 * Face output (<out> with .landmarks.json replaced by .face.json):
 * { video, fps, names: [52 blendshape names], frames: [{ i, t, ok, bs: [52 scores], box: [x0, y0, x1, y1] }] }.
 *
 * DEBUG_EVERY=N also writes <out>.debug.jpg: every Nth frame with the skeleton drawn on it.
 */
import { execFileSync } from "child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { basename, extname, join, resolve } from "path";
import { chromium } from "playwright";

const [videoArg, outArg] = process.argv.slice(2);
if (!videoArg || !outArg) {
  console.error("usage: npx tsx pose/extract.ts <video> <out.landmarks.json>");
  process.exit(1);
}
const FPS = Number(process.env.FPS || 30);
const SCALE = Number(process.env.SCALE || 0.5);
const DEBUG_EVERY = Number(process.env.DEBUG_EVERY || 0);
const DELEGATE = (process.env.DELEGATE || "GPU").toUpperCase();
const CHANNEL = process.env.CHANNEL || "chrome";
const HEADLESS = process.env.HEADLESS !== "0";
const MAX_FRAMES = Number(process.env.MAX_FRAMES || 0);
const TASKS = (process.env.TASKS || "pose,face").split(",").map((x) => x.trim());
const FACE_SCALE = Number(process.env.FACE_SCALE || 1);
const faceOut = outArg.replace(/\.landmarks\.json$/, "") + ".face.json";

const visionDir = resolve("node_modules/@mediapipe/tasks-vision");
const modelPath = resolve("pose/models/pose_landmarker_full.task");
const faceModelPath = resolve("pose/models/face_landmarker.task");
for (const p of [visionDir, modelPath, faceModelPath, videoArg]) if (!existsSync(p)) throw new Error(`missing ${p}`);

// 1. Intra-only proxy: exact per-frame seeks. Cached next to the other working clips.
mkdirSync("clips", { recursive: true });
const proxy = join("clips", `${basename(videoArg, extname(videoArg))}.intra${FPS}.mp4`);
if (!existsSync(proxy)) {
  console.log(`making proxy ${proxy} …`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", videoArg, "-vf", `fps=${FPS}`, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-g", "1", "-pix_fmt", "yuv420p", "-an", proxy], { stdio: "inherit" });
}
const proxySize = statSync(proxy).size;

// 2. One page. Everything it needs comes from the local server below.
const PAGE = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111">
<video id="v" muted playsinline preload="auto" src="/video.mp4"></video>
<canvas id="c"></canvas><canvas id="cf"></canvas><canvas id="sheet"></canvas>
<script type="module">
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "/vision_bundle.mjs";
const EDGES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]];
const JOINTS = [0,11,12,13,14,15,16,23,24,25,26,27,28];
window.__progress = { done: 0, total: 0, stage: "loading" };
window.__run = async ({ fps, scale, debugEvery, delegate, maxFrames, tasks, faceScale }) => {
  const v = document.getElementById("v");
  await new Promise((res, rej) => { if (v.readyState >= 1) return res(); v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("video failed to load")); });
  const W = v.videoWidth, H = v.videoHeight;
  const c = document.getElementById("c"); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const cf = document.getElementById("cf"); cf.width = Math.round(W * faceScale); cf.height = Math.round(H * faceScale);
  const fctx = cf.getContext("2d", { willReadFrequently: true });
  const vision = await FilesetResolver.forVisionTasks("/wasm");
  const create = async (Task, opts) => {
    try { return await Task.createFromOptions(vision, { ...opts, baseOptions: { ...opts.baseOptions, delegate } }); }
    catch (e) { window.__progress.note = "GPU delegate failed (" + (e?.message || e) + "), using CPU"; return await Task.createFromOptions(vision, { ...opts, baseOptions: { ...opts.baseOptions, delegate: "CPU" } }); }
  };
  const doPose = tasks.includes("pose"), doFace = tasks.includes("face");
  const lm = doPose ? await create(PoseLandmarker, { baseOptions: { modelAssetPath: "/model.task" }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputSegmentationMasks: false }) : null;
  const fl = doFace ? await create(FaceLandmarker, { baseOptions: { modelAssetPath: "/face.task" }, runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5, outputFaceBlendshapes: true }) : null;
  const faceFrames = [];
  let faceNames = null;
  const total = maxFrames ? Math.min(maxFrames, Math.floor(v.duration * fps)) : Math.floor(v.duration * fps);
  window.__progress = { ...window.__progress, total, stage: "detecting" };
  const seek = (t) => new Promise((res) => { const done = () => { v.removeEventListener("seeked", done); res(); }; v.addEventListener("seeked", done); v.currentTime = t; });
  const frames = [];
  const tileW = 270, tileH = Math.round(H * tileW / W), cols = 7;
  let sheet, sctx, tile = 0;
  if (debugEvery) { const n = Math.ceil(total / debugEvery); sheet = document.getElementById("sheet"); sheet.width = cols * (tileW + 6) + 6; sheet.height = Math.ceil(n / cols) * (tileH + 6) + 6; sctx = sheet.getContext("2d"); sctx.fillStyle = "#121212"; sctx.fillRect(0, 0, sheet.width, sheet.height); }
  for (let i = 0; i < total; i++) {
    await seek(i / fps + 0.0001);
    let rec = null;
    if (doPose) {
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const r = lm.detectForVideo(c, Math.round(i * 1000 / fps));
      const pose = r.landmarks?.[0];
      rec = pose ? pose.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4), +(p.visibility ?? 0).toFixed(3), +(p.presence ?? 0).toFixed(3)]) : null;
      frames.push({ i, t: +(i / fps).toFixed(4), ok: !!rec, lm: rec });
    }
    if (doFace) {
      fctx.drawImage(v, 0, 0, cf.width, cf.height);
      const r = fl.detectForVideo(cf, Math.round(i * 1000 / fps));
      const cats = r.faceBlendshapes?.[0]?.categories;
      const pts = r.faceLandmarks?.[0];
      if (cats && !faceNames) faceNames = cats.map((x) => x.categoryName);
      const box = pts ? [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))].map((x) => +x.toFixed(4)) : null;
      faceFrames.push({ i, t: +(i / fps).toFixed(4), ok: !!cats, bs: cats ? cats.map((x) => +x.score.toFixed(3)) : null, box });
    }
    if (doPose && debugEvery && i % debugEvery === 0) {
      const x = 6 + (tile % cols) * (tileW + 6), y = 6 + Math.floor(tile / cols) * (tileH + 6); tile++;
      sctx.drawImage(c, x, y, tileW, tileH);
      if (rec) {
        sctx.lineWidth = 3; sctx.strokeStyle = "#fff"; sctx.fillStyle = "#ffcc00";
        for (const [a, b] of EDGES) if (rec[a][3] > 0.3 && rec[b][3] > 0.3) { sctx.beginPath(); sctx.moveTo(x + rec[a][0] * tileW, y + rec[a][1] * tileH); sctx.lineTo(x + rec[b][0] * tileW, y + rec[b][1] * tileH); sctx.stroke(); }
        for (const j of JOINTS) if (rec[j][3] > 0.3) { sctx.beginPath(); sctx.arc(x + rec[j][0] * tileW, y + rec[j][1] * tileH, 5, 0, Math.PI * 2); sctx.fill(); }
      }
      sctx.fillStyle = "rgba(0,0,0,.7)"; sctx.fillRect(x, y, tileW, 22); sctx.fillStyle = "#fff"; sctx.font = "13px sans-serif";
      sctx.fillText((i / fps).toFixed(1) + "s " + (rec ? "" : "NOT TRACKED"), x + 6, y + 16);
    }
    if (i % 100 === 0) window.__progress.done = i;
  }
  window.__progress = { ...window.__progress, done: total, stage: "done" };
  window.__result = { fps, width: W, height: H, frames };
  window.__face = { fps, width: W, height: H, names: faceNames, frames: faceFrames };
  window.__sheet = debugEvery ? sheet.toDataURL("image/jpeg", 0.82) : null;
  return total;
};
</script></body>`;

// 3. Local server: page, bundle, wasm, model, and the proxy with byte ranges streamed from disk.
const server = createServer((req, res) => {
  const path = new URL(req.url || "/", "http://x").pathname;
  const send = (status: number, type: string, body: Buffer | string) => { res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(body) }); res.end(body); };
  if (path === "/" || path === "/index.html") return send(200, "text/html", PAGE);
  if (path === "/vision_bundle.mjs") return send(200, "text/javascript", readFileSync(join(visionDir, "vision_bundle.mjs")));
  if (path.startsWith("/wasm/")) { const f = join(visionDir, "wasm", basename(path)); if (!existsSync(f)) return send(404, "text/plain", "no"); return send(200, f.endsWith(".wasm") ? "application/wasm" : "text/javascript", readFileSync(f)); }
  if (path === "/model.task") return send(200, "application/octet-stream", readFileSync(modelPath));
  if (path === "/face.task") return send(200, "application/octet-stream", readFileSync(faceModelPath));
  if (path === "/video.mp4") {
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), proxySize - 1) : proxySize - 1;
    res.writeHead(m ? 206 : 200, { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": end - start + 1, ...(m ? { "Content-Range": `bytes ${start}-${end}/${proxySize}` } : {}) });
    createReadStream(proxy, { start, end }).pipe(res);
    return;
  }
  send(404, "text/plain", "no");
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// CHANNEL=bundled uses Playwright's own Chromium (also decodes H.264 as of Playwright 1.63).
const browser = await chromium.launch({ headless: HEADLESS, ...(CHANNEL && CHANNEL !== "bundled" ? { channel: CHANNEL } : {}) });
browser.on("disconnected", () => console.log("  browser disconnected"));
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log(`  page ${m.type()}:`, m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("  page error:", e.message.slice(0, 300)));
page.on("crash", () => console.log("  page CRASHED"));
page.on("requestfailed", (r) => console.log("  request failed:", r.url(), r.failure()?.errorText));

const started = Date.now();
try {
  await page.goto(`${origin}/index.html`, { waitUntil: "commit" });
  await page.waitForFunction(() => typeof (window as any).__run === "function", null, { timeout: 60000 });
} catch (e) {
  await new Promise((r) => setTimeout(r, 1500)); // let the event listeners above print first
  console.log(`  goto failed: ${(e as Error).message.split("\n")[0]} · browser connected: ${browser.isConnected()}`);
  process.exit(1);
}
const run = page.evaluate((o) => (window as any).__run(o), { fps: FPS, scale: SCALE, debugEvery: DEBUG_EVERY, delegate: DELEGATE, maxFrames: MAX_FRAMES, tasks: TASKS, faceScale: FACE_SCALE });
let last = -1;
const ticker = setInterval(async () => {
  try {
    const p = await page.evaluate(() => (window as any).__progress);
    if (p.stage === "detecting" && p.done !== last) { last = p.done; console.log(`  ${p.done}/${p.total} frames, ${Math.round((Date.now() - started) / 1000)}s${p.note ? " · " + p.note : ""}`); }
  } catch {}
}, 5000);
const n = await run;
clearInterval(ticker);
const result = await page.evaluate(() => JSON.stringify((window as any).__result));
const faceResult = await page.evaluate(() => JSON.stringify((window as any).__face));
const note = await page.evaluate(() => (window as any).__progress.note);
mkdirSync(join(outArg, ".."), { recursive: true });
const parsed = JSON.parse(result);
if (TASKS.includes("pose")) writeFileSync(outArg, JSON.stringify({ video: videoArg, proxy, ...parsed }));
const face = JSON.parse(faceResult);
if (TASKS.includes("face")) writeFileSync(faceOut, JSON.stringify({ video: videoArg, proxy, ...face }));
if (DEBUG_EVERY) {
  const dataUrl: string | null = await page.evaluate(() => (window as any).__sheet);
  if (dataUrl) writeFileSync(outArg.replace(/\.json$/, ".debug.jpg"), Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
server.close();
if (TASKS.includes("pose")) {
  const tracked = parsed.frames.filter((f: any) => f.ok).length;
  console.log(`wrote ${outArg} · ${n} frames @ ${FPS}fps · tracked ${Math.round((100 * tracked) / n)}% · ${Math.round(statSync(outArg).size / 1024)} KB`);
}
if (TASKS.includes("face")) {
  const tracked = face.frames.filter((f: any) => f.ok).length;
  console.log(`wrote ${faceOut} · ${face.frames.length} frames · face found in ${Math.round((100 * tracked) / Math.max(1, face.frames.length))}% · ${Math.round(statSync(faceOut).size / 1024)} KB`);
}
console.log(`done in ${Math.round((Date.now() - started) / 1000)}s${note ? " · " + note : ""}`);
