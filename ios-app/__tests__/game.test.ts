import { BIRD_X, DEATH_SEC, LIVE, MODES, newGame, onPose, step, type Game } from '../src/game';

/** A perfect player: flies through the gap of the next pipe the bird has not passed yet. */
const dodge = (g: Game) => {
  const next = g.pipes.find((p) => p.x + LIVE.pipeWidth > BIRD_X - 60);
  if (next) g.birdY = g.birdTarget = (next.gapTop + next.gapBottom) / 2;
};

test('a bird in the gap scores; each hit costs a life; the last one kills the bird and ends the run', () => {
  const g = newGame(2346, 'play', MODES[1], 600, 100);
  g.birdY = g.birdTarget = 1000;
  step(g, 0.016);
  const pipe = g.pipes[0];
  pipe.gapTop = 800;
  pipe.gapBottom = 1200;
  for (let i = 0; i < 400 && !pipe.passed; i++) step(g, 0.016);
  expect(pipe.passed).toBe(true);
  expect(g.score).toBe(1);
  expect(g.hits).toBe(0);

  // Park the bird far outside every gap: each pipe costs a life, the third kills it.
  g.birdY = g.birdTarget = 60;
  let end = null;
  for (let i = 0; i < 60 * 30 && !end; i++) {
    if (g.phase === 'play') g.birdY = g.birdTarget = 60;
    end = step(g, 1 / 60).end;
    if (g.hits === 1) expect(g.lives).toBe(MODES[1].lives - 1);
  }
  expect(g.hits).toBe(MODES[1].lives);
  expect(g.lives).toBe(0);
  expect(end).toBe('died');
  expect(g.t - g.diedAt).toBeGreaterThanOrEqual(DEATH_SEC);
  expect(g.score).toBe(1);
  expect(BIRD_X).toBeCloseTo(LIVE.birdX * 1080);
});

test('gaps swing across the band even at level 1', () => {
  const worldH = 2346;
  const g = newGame(worldH, 'play', MODES[0], 600, 100);
  const centres: number[] = [];
  for (let i = 0; i < 60 * 40; i++) {
    dodge(g);
    step(g, 1 / 60);
    for (const p of g.pipes) if (!centres[p.k]) centres[p.k] = (p.gapTop + p.gapBottom) / 2;
  }
  const spread = Math.max(...centres) - Math.min(...centres);
  expect(spread).toBeGreaterThan(0.25 * worldH);
});

test('the bird eases toward the body target instead of jumping', () => {
  const g = newGame(2346, 'play', MODES[0], 600, 100);
  g.birdTarget = 1500;
  step(g, 1 / 60);
  expect(g.birdY).toBeGreaterThan(1173);
  expect(g.birdY).toBeLessThan(1500);
  for (let i = 0; i < 30; i++) step(g, 1 / 60);
  expect(g.birdY).toBeCloseTo(1500, 0);
});

test('dodging every pipe until the timer runs out is a win', () => {
  const g = newGame(2346, 'play', MODES[1], 60, 100);
  let end = null;
  for (let i = 0; i < 61 * 60 && !end; i++) {
    dodge(g);
    end = step(g, 1 / 60).end;
  }
  expect(end).toBe('time up');
  expect(g.hits).toBe(0);
  expect(g.score).toBeGreaterThan(20);
});

/** A pose with both shoulders at height y (0..1 of the image), half a shoulder width apart from the centre. */
const pose = (y: number, halfWidth: number) => {
  const lm = new Array(33 * 5).fill(0);
  const set = (k: number, x: number) => lm.splice(k * 5, 5, x, y, 0, 1, 1);
  set(11, 0.5 + halfWidth);
  set(12, 0.5 - halfWidth);
  return lm;
};

test.each([0.1, 0.2])('countdown calibrates plank and distance (shoulders %f of the width apart / 2)', (halfWidth) => {
  const worldH = (812 * 1080) / 375;
  const g = newGame(worldH, 'ready', MODES[1], 600, 100, 5);
  const view = { screenW: 375, screenH: 812 };
  const feed = (y: number, sec: number, t0: number) => {
    for (let i = 0; i < sec * 30; i++) {
      onPose(g, { t: t0 + i / 30, w: 1080, h: 1920, lm: pose(y, halfWidth) }, view);
      step(g, 1 / 30);
    }
  };
  feed(0.3, 4.5, 0);
  expect(g.phase).toBe('ready');
  feed(0.3, 1, 4.5);
  expect(g.phase).toBe('play');
  expect(g.calib).not.toBeNull();
  expect(g.birdY / worldH).toBeCloseTo(0.275, 2);
  // A full push-up: shoulders drop 0.7 shoulder widths (width in image px -> height fraction).
  const travel = (0.7 * 2 * halfWidth * 1080) / 1920;
  feed(0.3 + travel, 2, 5.5);
  expect(g.birdY / worldH).toBeCloseTo(0.725, 2);
});
