# iOS app: build brief

Written 23 September 2026 at the end of the chat that built the video template, as the handoff for the chat that builds the app. Read `CLAUDE.md` (rules) and `docs/CONTEXT.md` (evidence, decisions, the video renderer) first.

## What we are building

A push-up game on iPhone where your head flies the bird. The phone sits on the floor in portrait, front camera facing the player; the player does push-ups; the bird follows their head up and down; pipes scroll in; every 15 pipes (a "lap") the level goes up and the game gets faster; ELO climbs; when the player drops to their knees the run is over. Every run exports a ready-to-post 9:16 video.

It is the live version of the video template this repo already renders (`render/FlappyVideo.tsx`, final render `~/Downloads/take1_flappy_v8.mp4`). The owner loves that video; it is the visual and behavioural spec for the app.

Why this app, in one line: Push Up Arena showed the loop (the app's own screen is the content: 17 posts over 1M views in four months at $9.99 a month), the push-up space pays (Pushscroll about $300K MRR per the owner), and a copy of the Flappy push-up TikTok filter runs on the owner's own face account. Owner's goal: $20K within 2 months of launch. Details and sources in `docs/CONTEXT.md`.

## Target

- **iOS only for now. iPhone X and newer.** The iPhone X tops out at iOS 16, so the deployment target is **iOS 16.0**. Check that every framework and the Xcode version can build for 16.0 before committing to them.
- **Performance floor: iPhone X (A11 chip).** Camera, on-device pose (and face, if used live) and the game must hold 30 fps there. Test on the oldest phone available; the owner's phone is much newer.
- Portrait, front camera, phone on the floor about 1 to 1.5 m in front of the player. Real framing: `public/IMG_0889.MOV` (76 s take, 1080x1920).
- This Mac: Xcode 26.5 (17F42), iOS 26.2 simulator runtime, Node 22.11, npm 11.9. The owner's iPhone shows in Xcode as "Ali" (iOS 26.4.2). The simulator has no camera: anything camera-related is tested on the phone.

## Stack constraints

- **TypeScript.** Owner's rule: TypeScript only, deployable to a phone or a server. The game logic in `engine/` is pure TypeScript and must be reused, not rewritten:
  - `engine/flappy.ts`: level table, pipe geometry and scroll, ELO per lap (`DEFAULT_ELO`), give-up detection (`giveUpAt`), bird track and tilt.
  - `engine/reps.ts`: push-up rep counting from the elbow angle (down < 95°, up > 150°, 0.5 s lock-out before a rep can start).
  - `engine/pain.ts`: grimace score from face blendshapes (drives the boom zoom).
- That points to **React Native with TypeScript (Expo or bare)**, with native modules only where the camera and the ML models need them. The model calls are native by nature; everything above them stays TypeScript. This is my recommendation, not a decision the owner has made: confirm it with him.
- **Models:** the video pipeline uses Google MediaPipe (`pose/models/pose_landmarker_full.task`, 33 body points; `pose/models/face_landmarker.task`, 52 blendshapes). Using the same models on the phone (MediaPipe Tasks for iOS) means the engine's thresholds carry over unchanged. Apple's Vision body-pose detector is the other option (19 joints, different geometry): the thresholds would have to be re-measured. Check the MediaPipe iOS SDK's support for iOS 16 and its speed on an A11 early (the "lite" pose model exists if "full" is too slow).
- **Backend: not needed for the first playable build.** When it is: the owner's default stack is Supabase (auth, Postgres with row-level security, storage) plus a worker on a Hetzner box with RabbitMQ for heavy jobs. **Payments on iOS go through Apple In-App Purchase** (App Store rule for digital content), not Stripe.
- Nothing from HardLaunch (code, keys, accounts).

## Game spec (from the video, where it applies)

- **Bird:** height = the player's head (nose) height, amplified 1.15x around a calibrated centre, smoothed (0.35); horizontal position 22% of the screen width; tilts nose-up when rising, dives when falling; wing flaps. Drawn in code: `Bird` in `render/FlappyVideo.tsx`. Never use Flappy Bird's sprites or name.
- **Pipes:** salmon palette (body #E98B71, light #F4A98F, dark #C4664C, rim #8E432E), body 132 px on a 1080-wide screen, 60 px caps with 13 px overhang. Drawn in code: `PipePair`.
- **Big difference from the video:** the renderer fits each pipe's gap to where the recorded head actually was, so a recorded set always reads as a clean run. A live game cannot see the future: gaps must be generated ahead of the bird inside the player's calibrated head range (1 or 2 warm-up push-ups to measure the head's top and bottom), and hitting a pipe must have a consequence. Ask the owner: game over on the first hit, or lives?
- **Levels:** every 15 pipes. The video's table is in on-screen pixels per second of a 1.5x-speed video (`DEFAULT_LEVELS` in `engine/flappy.ts`): L1 570 px/s with pipes 646 px apart, L2 900 px/s and 450 px apart (the reference video, measured frame by frame), L3 1000/420, L4 1100/400, L5+ 1200/380, gaps shrinking 370 → 300. A live game runs in real time, not 1.5x: start from the clip-time equivalent (divide the speeds by 1.5: L1 380 px/s, a pipe every 1.7 s) and tune on the phone with the owner.
- **Score** +1 per pipe passed. **ELO** +1 per completed lap, +3 per lap after 5 laps (`DEFAULT_ELO`). Starting ELO in the video: 1247.
- **Run ends** when the player gives up: knees come down and no push-up starts again (`giveUpAt`; knee visibility from the pose model; a mid-set false alarm is filtered by the "no rep afterwards" rule). The exported video hard-cuts at that moment.
- **Boom zoom** (grimace detected, vine boom at 70% volume, face pulled to the centre at 1.7x, pipes stay visible): in the video it is an edit. In the app it probably belongs in the exported replay, not live play (a zoom mid-run would disrupt the player). Confirm with the owner.
- **HUD (player panel), right-hand strip only** (x ≥ 820 of 1080, where the face and the bird never go): avatar in a ring of the level colour with the level gem on its corner, name, "ELO 1248", "SCORE" label and number, a 15-step rail with a mini bird. Font Lilita One (`public/fonts/LilitaOne-Regular.ttf`, OFL licence). Outline and hard shadow #2B160E, labels #FFE7C2, level colours gold #FFC53D, aqua #35E0CF, pink #FF6FA8, violet #A98CFF, red #FF5B4E. Level-up burst ("LEVEL 2 / SPEED UP!") on the floor area below the hands. **Nothing ever covers the player's face.**
- **Sound:** level-up sting (`public/audio/levelup.wav`), vine boom (`public/BG_SFX/vine-boom.mp3`), music bed. Every sound effect at 70%, one-shot, never looped.

## The exported run is the product's marketing

Each run should export a 1080x1920 video that looks like the renderer's output, so the owner can post it straight to TikTok and Instagram. Two ways, to decide early:
1. Record the composited screen (camera + game + HUD) live while playing.
2. Save the raw camera and a per-frame game-state log, then composite after the run, like the renderer does. More control (boom zooms, hard cut at give-up, 1.5x speed-up), more work on device.

## Suggested first milestones

1. `git init` and a first commit, so this chat and the video chat can work in the same folder without overwriting each other. Put the app in its own folder (for example `ios-app/`) that imports `engine/`.
2. Decide the stack (check iOS 16.0 support), scaffold, run a blank app on the owner's iPhone.
3. Front camera preview plus on-device pose at 30 fps, skeleton drawn over the camera. Measure the frame rate and delay.
4. Calibration, bird follows the head, level 1 pipes, collisions, score.
5. Levels, ELO, give-up ends the run, the player panel.
6. Export the run as a 1080x1920 video.
7. Later: accounts, ranked 1v1 against recorded "ghost" runs (the second content twist, see `docs/CONTEXT.md`), paywall through Apple In-App Purchase.

## Open decisions for the owner

- React Native (my recommendation, fits the TypeScript rule) or something else.
- Collision: game over or lives.
- Boom zoom: replay only, or live too.
- Pricing: Arena's hard $9.99/month paywall is hated in its reviews; a free daily run plus paid ranked play is an untested idea.
- App name.
- Apple Developer Program ($99 a year) for TestFlight and the App Store. Free provisioning is enough to run on his own phone.

## Shared folder

- The video chat keeps working in `render/`, `pose/`, `engine/`, `public/`. `engine/` is shared: any change must keep `npx tsc -p .` passing and the renderer's output unchanged.
- Assets the app can reuse: `public/fonts/`, `public/avatar.jpg` (the owner's profile photo, cropped), `public/BG_SFX/vine-boom.mp3`, `public/audio/levelup.wav`, `pose/models/*.task`.
