/**
 * Stage one take for rendering: copies the match, the landmarks and the proxy clip into
 * public/render/<take>/ where the Remotion composition reads them.
 *
 *   npx tsx render/prepare.ts take1
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const take = process.argv[2];
if (!take) {
  console.error("usage: npx tsx render/prepare.ts <take>");
  process.exit(1);
}
const inputs = {
  "match.json": join("engine", "out", `${take}.match.json`),
  "reps.json": join("engine", "out", `${take}.reps.json`),
  "landmarks.json": join("pose", "out", `${take}.landmarks.json`),
  "face.json": join("pose", "out", `${take}.face.json`),
  "video.mp4": join("clips", `${take}_30fps.mp4`),
};
const dir = join("public", "render", take);
mkdirSync(dir, { recursive: true });
for (const [name, src] of Object.entries(inputs)) {
  if (!existsSync(src)) throw new Error(`missing ${src}`);
  copyFileSync(src, join(dir, name));
  console.log(`${src} → ${dir}/${name}`);
}
