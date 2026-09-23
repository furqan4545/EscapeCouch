# Mob_app

Gamified push-up app, content first. Two tracks run in this folder, often in parallel chats:

- **Video template** (`pose/`, `engine/`, `render/`): turns a phone clip of push-ups into a ready-to-post Flappy-style game video. Read `docs/CONTEXT.md`: the decision, the evidence, the template spec, every knob and every command.
- **iOS app**: the live game. Read `docs/APP_BRIEF.md` first, then `docs/CONTEXT.md`.

`engine/` is shared by both: any change must keep `npx tsc -p .` passing and the video renderer's output unchanged.

## Rules the owner set

- **TypeScript only.** No Python anywhere; everything must be deployable to a phone or a server.
- **iOS app: iPhone X and newer, deployment target iOS 16.0.** iOS only for now.
- **When the owner names a reference video as the template, copy it literally first**: its audio, its native TikTok text look, its layout and pacing. Add extras (HUD, levels, booms) as toggles on top. The current template is the Flappy Bird push-up video (`research/evidence/gamified-reference/reference.mp4`); its measured pace is level 2 of the game.
- **Nothing may ever sit on the owner's face.** Any overlay (HUD, bursts, stickers other than the reference caption) goes where the face never goes; check against the face box computed from the landmarks. The HUD lives in the right-hand strip (x ≥ 820 of 1080) and bursts on the mat below the hands.
- Videos end with a hard cut the moment he gives up (knees down, `giveUpAt`), never on a fresh level-up.
- The boom zoom fires only on a pained (grimacing) face, never on a normal one: `engine/pain.ts` from the face pass, checked with `engine/pain-check.ts`. Zoom sound = `public/BG_SFX/vine-boom.mp3`. Pipes stay visible during the zoom.
- Every sound effect plays at 70% (`SFX_LEVEL`), one-shot, never looped; music beds are exempt.
- Captions use the TikTok-native text spec: TikTok Sans Medium, white, black outline 11/56 of the font size, soft shadow, line height 1.22.
- ELO: shown as the text "ELO 1248" (no trophy). +1 per lap (a lap = one level = 15 pipes), +3 per lap after 5 laps (`DEFAULT_ELO` in `engine/flappy.ts`).
- Final renders get copied to `~/Downloads`.
- Nothing is reused from HardLaunch (code, keys, accounts). Playwright is the TikTok research driver: plain driver only, no stealth patches, never solve or dodge verification puzzles.
- Every number shown to the owner is tagged real or guess. Never model app revenue from rating counts.
- Copy mechanics, never another game's art or name (bird and pipes are drawn in code).
- When replacing code, delete the old path. No "fallback" code paths; show errors instead of hiding them.

## Working with the owner (Furqan)

- Answer in the first sentence, details after. If a step takes more than a minute, say what you are doing.
- Explain mechanisms with a picture and real numbers, not paragraphs of theory. Say where every number came from and mark your own guesses.
- Recaps in plain English: what was wrong (what he saw), why, what happens now. No engineer shorthand; no long dashes or jargon in anything user-facing.
- Check your own work before reporting: render the frames and look at them, run the checks. Never ask him to verify.
- He is direct and swears when something is wrong. Take it as a precise signal about what to fix and keep the reply short.
- Commit or push only when he asks. Work on main, no worktrees.
