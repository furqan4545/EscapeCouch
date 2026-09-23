# Mob_app: context for any session

Updated 23 September 2026. This file is the source of truth for what was decided and why. `research/BRIEF.md` and `research/output/` are an earlier research pass (22 Sep) and are partly superseded by the decisions below.

## The decision

**Owner's template (23 Sep, said with force): the FLAPPY BIRD push-up video is the template to copy exactly.** Bird height = the owner's head height as he goes up and down; pipes scroll in from the right; score counts. Composition `flappy` (`render/FlappyVideo.tsx`, core in `engine/flappy.ts`). Pipe gaps are fitted to where the head actually was when each pipe arrives, so a recorded set always reads as a clean run. Bird and pipes are drawn in code, our own art, not the Flappy Bird sprites. The 1v1 "match" composition below stays in the repo as the second twist for later, not the first post.

Build a **gamified push-up app** whose own screen is the content, and get there **content first**:

1. **Renderer first (this week).** A pipeline that takes a phone clip of push-ups and outputs the "app screen": pose skeleton, rep counter, ranked 1v1 header, opponent tug-of-war bar, timer. Output is clean (no music, no hook text); sound and hook are added in TikTok at post time. One render becomes several posts.
2. **Mobile app second (starts when a post clears ~500K or comments fill with "what app is this").** iPhone first. Same game core running live, real opponents, ranks, in-app capture with the same HUD.

The renderer is not a throwaway: the game core (landmarks in, rep events and match state out) and the HUD components are the app's engine and UI.

## Why this and not something else (evidence, all from public TikTok / App Store data pulled 21-22 Sep 2026)

- Format hunt over 213 fitness accounts: the formats that repeat are macro-reveal recipes (10 repeat winners), react-then-your-version (6), same-body-new-hook (5), faceless list compilations (5). One-time transformation reveals and "day 1 of" series do not repeat. Report: https://claude.ai/artifact/26qfekVh2MsGSgoBjrC9DR
- Owner rejected food (work burden) and fleets; constraints: max 5 TikTok accounts, owner's face on the main one, daily posting, low effort per post, replicable template.
- The Flappy Bird push-up video (4M on IG) is a TikTok camera effect, not an app. 84 such posts from 68 authors, 9 over 1M; small accounts hit huge (15K followers → 22.5M) but per account it decays (18.5M → 37K → 13K). Good for one launch spike per account, not a daily format.
- **Push Up Arena** (@pushuparena.app, Airix LLC, released 14 May 2026, iPhone only, $9.99/mo hard paywall after a 3-day trial, 100K+ downloads in 90 days) is the proof of the loop: 124 unpinned posts in 135 days, 48 over 100K, 17 over 1M. Same template daily; only hook line, sound, opponent and outcome change. Hooks in the "I underestimated him and lost" shape: median 803K, 1,452 shares. "Rank gap" hooks: median 182K. "What is this app" hooks on the app's own account: median 6K. Posts with a slowed phonk sound: medians 0.8M to 3.1M vs 41K on original sound. Boss-fight content plateaued at ~20K medians for two months; the ranked 1v1 twist (from 28 Jul) made August (31 posts, median 286K). September median fell to 67K: a template peaks 6 to 8 weeks, plan the next twist by week 6.
- 1v1 in Arena is live rep-count sync (avatar, ELO, timer, bar), not video. Their ELO never changed across a month of posts, so their clips are staged demos. Do not claim live opponents until they exist; a ghost made from a real recorded run is honest.
- Money: the biggest push-up apps are "do push-ups to unlock your apps" blockers. Pushscroll (Jun 2025, $14.99/mo, 750K+ downloads) is ~$300K MRR per the owner. Push Up Arena is probably $60K to $150K MRR (estimate, unanchored). Category copies an idea in 3 to 6 months: 11 blocker clones, 8 game clones. Edge = distribution and fairness, not the mechanic.

## Template spec (what to keep, what to vary)

Keep: phone on the floor, face to camera, one person, 18 to 22 seconds, app HUD, skeleton, rep counter, opponent bar.
Vary per post: opponent (name, ELO, pacing), outcome (win/lose/close), hook line as a TikTok text sticker (2 stickers median), caption as a second joke, sound (slowed phonk on the ones you believe in).
Hook shapes ranked by Arena's data: "I lost / I underestimated him" > "rank gap (noob vs pro, bronze vs master, 4K elo)" > "skill vs spam / cheating / new strat" > boss/level > "what is this app" (dead on the app's own account).

## Build plan

- `pose/`: TypeScript only (owner's rule, 23 Sep: no Python, everything must be deployable to phone or server). `pose/extract.ts` drives a Playwright Chrome page that runs Google's `@mediapipe/tasks-vision` Pose Landmarker over the clip frame by frame and writes `landmarks.json` (per frame: 33 landmarks, visibility, presence). Model: `pose/models/pose_landmarker_full.task` (Google's official file, 9.4 MB). Note for the app: the model call is platform-specific by nature (MediaPipe iOS/Android SDK or Apple Vision on the phone, tasks-vision on web/server); the engine above it is the shared code.
- `engine/`: TypeScript game core, pure functions. Rep detection from elbow angle (shoulder-elbow-wrist; down < ~90°, up > ~160°, count on the up transition, smoothed). Match state per frame: your reps, ghost reps, bar position, timer, result. Ghost = a rep timeline JSON (a previous take, a friend's clip through the same pipeline, or an authored pacing curve).
- `render/`: Remotion composition. Original clip as background, HUD on top, MP4 out. Owner already runs Remotion (rezi-quiz-remotion).
- `clips/`: working proxies (gitignored). Source clip: `public/IMG_0889.MOV` (1080x1920, HEVC, 60 fps, 76 s, recorded 22 Sep).

## Flappy composition: CURRENT props (v6, 23 Sep) — read this, not the history below

```
npx tsx render/prepare.ts take1          # stages landmarks, reps, face, match, video into public/render/take1/
npx remotion render render/index.ts flappy render/out/<name>.mp4 --props='{"take":"take1","startSec":-1,"endSec":-1,"offsetFrames":0,"speed":1.5,"track":null,"pipes":null,"opts":{},"header":true,"player":{"name":"Furqan","avatar":"avatar.jpg"},"elo":1247,"caption":"Push day killer 💀","music":"audio/goggins.m4a","musicVolume":0.9,"dings":false,"levelSfx":true,"booms":[]}'
```

- `startSec`/`endSec` -1 = auto: 2.5 s before the first rep → the give-up moment (hard cut). `speed` = playback rate (1.5).
- `header`: right-hand player panel on/off (off = the reference's look). `player` { name, avatar under public/ }, `elo` (starting ELO), `eloRule` (optional; default `DEFAULT_ELO` in `engine/flappy.ts`: +1 per lap, +3 per lap after 5 laps; a lap = one level = 15 pipes; owner, 23 Sep). The panel shows "ELO 1248" as text (the trophy icon is gone, owner's ask).
- `caption`: TikTok-native text at 215 px. `music` + `musicVolume`: the bed (exempt from the SFX rule). `dings` (off), `levelSfx` (on); all effects at `SFX_LEVEL` 0.7.
- `booms`: [] = auto from the face (grimace only); or [{ "t": clipSec, "hold": clipSec }] to force.
- `opts`: overrides of `DEFAULT_FLAPPY` in `engine/flappy.ts`: `levels` (on-screen table: pxPerSec, distance, gap), `levelEvery` 15, `pipeWidth` 132, `gain` 1.15, `birdX` 0.22, `firstPassSec` 1, `endLevelGuardSec` 1.5. `playback` is set from `speed` by Root.
- New take: `npm run pose -- <clip> pose/out/<take>.landmarks.json` (pose + face), `DURATION=60 npm run engine -- pose/out/<take>.landmarks.json` (reps), make `clips/<take>_30fps.mp4`, `npx tsx engine/pain-check.ts <take>` (eyeball the booms), prepare, render.

## Flappy composition: history (v2 → v6, 23 Sep)

v2 knobs (superseded where later versions say so):

Render: `npx remotion render render/index.ts flappy render/out/<name>.mp4 --props='<json>'` with props:
`take`, `startSec`/`endSec` (-1 = auto: first rep − 2.5 s to last rep + 3 s), `speed` (clip playback rate; 1.5 = everything 1.5x faster, owner's ask), `caption` (baked sticker under the header, empty for none), `music` (path under public/, e.g. `audio/music.mp3`; the placeholder bed is the owner's quiz-project track), `musicVolume`, `sfx` (ding per pipe from the owner's `sfx/ding.wav`; synthesized `audio/levelup.wav` on level-ups), `player` `{ name, elo, best }`, `showScore`, `opts` (overrides of `engine/flappy.ts` DEFAULT_FLAPPY: `speedPxPerSec` 380, `spacingSec` 1.7, `minGap` 370, `gain` 1.15, `birdX` 0.22, `levelEvery` 15, `speedStep` 1.18, `spacingStep` 0.88, `gapStep` 28).
Levels: every `levelEvery` pipes the scroll speed multiplies by `speedStep`, spacing by `spacingStep`, the gap shrinks by `gapStep` px (floor 250). Pipe positions integrate the per-level speed so nothing jumps at a level change. A LEVEL n / SPEED UP burst with a flash and the sting plays for 1.6 s. Header: avatar, name, ELO, best, big score (pulses amber on each pass), LVL, current speed multiplier, "next in N", progress bar to the next level.
Owner's words on 23 Sep: "this is not obv finish thing, but we are getting somewhere". Still wanted: a death/game-over ending, presets (easy/normal/brutal).

**v3 (23 Sep, after the owner's second correction: "copy the video exactly as I shared"):**
- Audio = the reference video's own hype rep-count track (`public/audio/goggins.m4a`, extracted from the clip he sent), `musicVolume` 0.9. Per-pipe dings OFF by default (`dings`), level-up sting ON (`levelSfx`).
- Caption = TikTok-native text, the owner-approved spec from 23 Aug: TikTok Sans Medium (`public/fonts/TikTokSans-Medium.ttf`, Google Fonts file), white, black outline 11/56 of the font size, shadow 2/56 offset 5/56 blur, line height 1.22. Size 58 px. Sits at 215 px (11% from the top, like the reference) without the header, 372 px under it.
- `header` toggle: false = the reference's look (bird, pipes, caption only); true = ELO/score/level header. Both were rendered: `take1_flappy_v3_ditto.mp4`, `take1_flappy_v3_header.mp4`.
- Boom zoom (v3 version, REPLACED in v6): fired on slow reps / long stalls via `tiredMoments()`, which the owner rejected because it zoomed on normal faces; that function is deleted. See v6 for the pain-triggered zoom.

**v4 (23 Sep, owner: "the scorecard on the top looks very ugly and is almost distracting" and "the obstacles are very slow moving... for level 1 it is fine, far is fine, but in level 2 we need to close up the obstacles and increase their speed too"):**
- Reference measured frame by frame (`research/scripts/measure-reference.ts` on `research/evidence/gamified-reference/reference.mp4`): one constant pace for all 48 s, 900 px/s at 1080 wide, pipes 450 px apart (one every 0.50 s), pipe body 129 px, gap median 438 px. The reference has no levels.
- Levels are now an explicit table in ON-SCREEN units (`DEFAULT_LEVELS` in `engine/flappy.ts`; the engine converts with `opts.playback`, which Root sets from `speed`): L1 570 px/s, 646 apart, gap 370 (unchanged, owner-approved); L2 900 px/s, 450 apart, gap 360 (= the reference); L3 1000/420/340; L4 1100/400/320; L5 1200/380/300; beyond the table the last row repeats. `pipeWidth` 132 (reference 129). take1 at 1.5x: L2 from 16.9 s, L3 ~24 s, L4 ~30.5 s, final score 60, 3 pipes on screen from L2 on.
- HUD redesigned with no panel (`ArcadeHud` in `render/FlappyVideo.tsx`): level gem (hexagon, one colour per level: gold, aqua, pink, violet, red) left, big score centre (bounces on each pass), trophy + ELO right (`elo` prop, `eloPerLevel` 15 counts up with a "+15" on each level-up), and a slim 15-step rail under the score where a mini bird moves one step per pipe. All HUD text is Lilita One (`public/fonts/LilitaOne-Regular.ttf`, OFL) with a warm near-black outline (#2B160E) and a hard drop shadow. Level-up burst restyled to match, in the level colour.
- Caption, HUD and level-up burst now sit OUTSIDE the boom zoom; only the camera layer (video, pipes, bird) zooms.
- Fonts load through `@remotion/fonts` `loadFont` (holds the render until ready).

**v5 (23 Sep, owner: "i need my profile pic avatar too", "the stats are sitting right on my face, this is the big issue", "when i give up and sit down... dont jump to level 5, just cut the video as soon as i give up"):**
- HUD moved into a right-hand player panel (`PlayerPanel`), centred at x 940, top 202 to ~590. Measured on take1: across 1,649 frames the face stays between x 386 and 751 and the bird owns x 154-322 (it enters the top-left band in 22% of frames), so x ≥ 820 is touched by neither. Panel: avatar (`player.avatar`, path under public/, ring in the level colour, INK outline) with the level gem on its corner, `player.name`, trophy + ELO, "SCORE" label and the score, the 15-step rail with the mini bird. Rule: nothing may sit on the face; check new layouts against the face box from the landmarks.
- Avatar = `public/avatar.jpg`, a 460 px square crop around the face of `~/Downloads/dp.jpg` (his profile photo), scaled to 256.
- Level-up burst moved to the mat below the hands (centre y 1420; wrists sit at ~1240).
- Give-up cut: `giveUpAt()` in `engine/flappy.ts`. The knees are hidden in a plank from the floor camera and BlazePose knee visibility jumps when they drop; a knees-down moment (≥0.5, held ≥0.45 for 1 s) only counts after the last rep's descent has started, because the model also flags knees mid-set (take1: 21.0 s, a clear plank on video). Root ends the window there by default (hard cut); take1: 66.37 s → the video is 34.3 s, final score 54, level 4.
- `endLevelGuardSec` (1.5 s of video): the pipe that would complete a level is never placed in the last 1.5 s, so a video can't end on a fresh level-up.

**v6 (23 Sep, owner: "trigger sudden zoom in only on painful face, not on normal face at all" + "use this BG sfx" = `public/BG_SFX/vine-boom.mp3`):**
- Face pass: `pose/extract.ts` now also runs Google's FaceLandmarker (`pose/models/face_landmarker.task`) at full frame size and writes `pose/out/<take>.face.json` (52 blendshape scores per frame + face box). `TASKS=pose,face` (default both); take1 face found in 1,538 of 1,544 window frames; ~10 min for 76 s at full size.
- Pain score (`engine/pain.ts`) = grimace: mean(mouthSmile L/R) + 2 x mean(mouthStretch L/R) + 2 x mean(mouthUpperUp L/R), smoothed 0.25 s; a moment is a run ≥0.3 above the take's median held ≥0.2 s; strongest win, onsets ≥2.4 s apart, max 5. Evidence: the textbook PSPI formula (brow lowerer + eye squeeze + nose wrinkle + eyes closed) fired on him looking at the floor and missed his real grimaces; labelled 0.5 s face grid on take1 showed his pain face is bared teeth / pulled-back lips (mouthSmile 0.52 vs 0.07 normal, AUC 0.94; mouthStretch 0.09 vs 0.02, AUC 0.90; browDown goes DOWN when he grimaces). take1 booms at clip 19.6, 48.8, 55.2, 58.8, 64.0 s, every one a grimace by eye; the old slow-rep booms (35.7, 44.0, 52.6) scored 0.05-0.32 (normal faces). Check any take with `npx tsx engine/pain-check.ts <take>` → `engine/out/<take>.pain_faces.jpg` + `.pain_plot.png`.
- Boom zoom: holds for the grimace's length (0.33-1.0 s of video; a longer grimace centres the hold on its worst frame), follows the face (nose, 7-frame average), scales 1.7x and slides the face to (540, 900) clamped so no black edges. Pipes and bird stay on screen and zoom with the camera: v6 faded them out, and the owner's only note on v6 ("I love it") was "when you trigger zoom in, the walls are gone... don't touch anything else, just bring back the wall" (walls = pipes). Caption, player panel and level-up stay fixed. Sound = vine boom.
- Sound: `SFX_LEVEL = 0.7` in `render/FlappyVideo.tsx`; every sound effect (vine boom, level-up sting, dings) plays at 70%, one-shot (house rule from the owner, 24 Aug). The hype track is the music bed (0.9), exempt. Props: `booms: [{ t, hold }]` in clip seconds (empty = auto from the face).

## How to run the renderer (working as of 23 Sep, take1)

```
npm run pose -- public/IMG_0889.MOV pose/out/take1.landmarks.json   # ~4.5 min for 76 s; DEBUG_EVERY=90 adds a skeleton contact sheet
DURATION=50 npm run engine -- pose/out/take1.landmarks.json         # prints reps, simulates the match, writes engine/out/take1.{reps,match}.json
npm run plot -- engine/out/take1.reps.json engine/out/take1.plot.png # elbow-angle trace with rep markers, for tuning by eye
npm run render:prepare -- take1                                     # stages match, landmarks and clips/take1_30fps.mp4 into public/render/take1/
npm run render -- render/out/take1_match.mp4 --props='{"take":"take1","match":null,"landmarks":null,"offsetFrames":0}'
npm run studio                                                      # Remotion Studio to iterate on the HUD live
```

Engine env knobs: `DOWN` (default 95°), `UP` (150°), `SMOOTH` (0.5), `DURATION` (60), `START` (auto = first rep − 1.5 s + 3 s countdown), `GHOST_NAME`, `GHOST_ELO`, `GHOST_REPS`, `PACING` (steady, fast-start, late-surge, gas-out). Take names must match: `clips/<take>_30fps.mp4` is the video the composition plays (pose/extract.ts also writes `clips/<take>.intra30.mp4`, the seek proxy).

take1 result: 10 reps counted, matching a by-eye count; the three shallow dips (104-110°) are correctly not counted. Output is clean (no music, no hook text): add both in TikTok at post time. First full render (23 Sep): `render/out/take1_match.mp4` (57.5 s, 1080x1920, 30 fps) plus two post-length cuts, `take1_post_A_opening.mp4` (countdown + opening, 23.5 s) and `take1_post_B_ending.mp4` (last reps, 0:00, VICTORY card, 12 s). Render time ~10 min on the Mac; Remotion Studio (`npm run studio`) previews without rendering.

## Rules

- Nothing reused from HardLaunch (code, keys, accounts). Playwright is the TikTok research driver; never stealth patches, never solve verification puzzles.
- Every number shown to the owner is tagged real or guess. Do not model app revenue from rating counts (that was 6-10x too low).
- Copy the mechanic, never the art or the name of another game (Flappy Bird assets and name are protected).

## Open

- App name and the working name for the HUD.
- Pricing (Arena: hard paywall, hated in reviews; owner leaning to a free daily match allowance plus paid ranked, untested).
- Which sound to use on the first posts.
