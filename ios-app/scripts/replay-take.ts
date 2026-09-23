// Replays a recorded take (landmarks from pose/extract.ts) through the live game, frame by frame, the
// way the phone feeds it, for every difficulty. Checks what the owner cares about: the run never ends
// by itself before the real give-up, the pipes swing, and the bird can reach them.
//
//   npx tsx ios-app/scripts/replay-take.ts pose/out/take1.landmarks.json [giveUpSec] [countdownSec]
//   (take1: 66.37 15 - the countdown ends in plank just before the first rep)

import { readFileSync } from 'fs';
import { MODES, level, newGame, onPose, step } from '../src/game';
import type { PoseFile } from '../../engine/types';

const [path, giveUpArg, countdownArg] = process.argv.slice(2);
const take: PoseFile = JSON.parse(readFileSync(path, 'utf8'));
const realGiveUp = giveUpArg ? Number(giveUpArg) : null;
const screenW = 375, screenH = 812; // iPhone X points
const worldH = (screenH * 1080) / screenW;
let failed = false;

for (const mode of MODES) {
  const g = newGame(worldH, 'ready', mode, 600, 100, countdownArg ? Number(countdownArg) : 5);
  let end: string | null = null, endT = 0;
  const birds: number[] = [];
  const centres = new Map<number, number>();
  for (const f of take.frames) {
    const r = onPose(g, { t: f.t, w: take.width, h: take.height, lm: f.ok && f.lm ? f.lm.flat() : [] }, { screenW, screenH });
    const s = step(g, 1 / take.fps);
    if (g.phase === 'play') birds.push(g.birdY);
    for (const p of g.pipes) if (!centres.has(p.k)) centres.set(p.k, (p.gapTop + p.gapBottom) / 2);
    if (r.end || s.end) {
      end = r.end || s.end;
      endT = f.t;
      break;
    }
  }
  const cs = [...centres.values()];
  const reach = (c: number) => c >= Math.min(...birds) && c <= Math.max(...birds);
  const reachable = cs.filter(reach).length / cs.length;
  console.log(`${mode.name.padEnd(21)} end: ${end ? `${end} at ${endT.toFixed(1)}s (cut back ${g.cutBackSec.toFixed(1)}s -> ${(endT - g.cutBackSec).toFixed(1)}s)` : 'none'} | played ${g.t.toFixed(1)}s, score ${g.score}, hits ${g.hits}, lives ${g.lives}/${mode.lives}, level ${level(g)}, reps ${g.reps} | bird ${Math.round(Math.min(...birds))}-${Math.round(Math.max(...birds))}, gap centres ${Math.round(Math.min(...cs))}-${Math.round(Math.max(...cs))} (${Math.round(reachable * 100)}% inside the bird's reach) of ${Math.round(worldH)}`);
  if (end === 'gave up' && realGiveUp !== null && endT - g.cutBackSec < realGiveUp - 1) {
    console.log(`  FAIL: ended as a give-up at ${(endT - g.cutBackSec).toFixed(1)}s, the real give-up is at ${realGiveUp}s`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
