# MobApp (iOS app)

The live push-up game. Bare React Native 0.87 with TypeScript, no Expo (Expo SDK 56+ needs iOS 16.4; our floor is iOS 16.0 for the iPhone X). The game rules come from `../engine/`, shared with the video renderer; Metro watches that folder (`metro.config.js`).

- Deployment target iOS 16.0, iPhone only, portrait only.
- Bundle id `com.furqanali.mobapp`, team `37P86CG9SS` (Furqan Ali), automatic signing.
- Android is not set up yet (iOS only for now).

## The game (first playable, 23 Sep)

- First launch: onboarding (welcome, name + weight, avatar: assigned emoji with REROLL or your own photo, 100 ELO and the rank ladder). EDIT on the menu reopens it. Profile saved in UserDefaults (`src/profile.ts`); the camera prompt comes after onboarding.
- ELO starts at 100; per lap +10, +30 after 5 laps in a run (the video rule x10, `APP_ELO` in `src/game.ts`). Ranks: Wobbly Pawn 0, Knight in Sweaty Armor 150, Bishop of Biceps 250, Rook Solid 400, Queen of Gains 600, Push-up Grandmaster 900, Final Boss 1300.
- Calories (`src/food.ts`): 8 METs (Compendium 02020, vigorous calisthenics) x 3.5 x kg / 200 per active minute; shown as food (grape 3, gummy bear 8, Oreo 53, banana 105, cola can 140, glazed donut 190, pizza slice 285, Big Mac 590 kcal). Today's total resets at local midnight, with a roast when low.
- The bird blinks every 5 s.
- Keyboard rule (owner): it never covers a field or button. Every screen with a field is a `KeyboardPage` (`src/Onboarding.tsx`): padded by the real keyboard height, scrolls to its button when the keyboard shows, tap outside hides it, and a DONE bar sits on the keyboard. Jokey labels carry the plain meaning in brackets. Tested on an iPhone X-sized simulator (iPhone 13 mini, 375 x 812).
- Menu: pick a difficulty (Noodle Arms, Gym Rat, Protein Shake Addict, Built Different) and a timer (1, 2, 3, 10 min or custom), then START (starts the screen recording; iOS asks once).
- Get ready: a countdown (menu: 3/5/10/15 s, default 5) to get on the floor. The last second of plank calibrates the run: plank height and shoulder width (how far you are). Body movement is then measured in shoulder widths (same near or far): plank = bird at the top of the gap band (0.275 of the screen), a full push-up (0.7 shoulder widths lower, take1) = the bottom (0.725, deeper at higher levels). The bird eases toward that at 60 fps.
- Pipes move at the video's on-screen speeds in every mode (level 1 570 px/s up to 1200 at level 5). Easier modes only space pipes out (1.8x, 1.35x); the top two start at level 2 and 3. Gap swings grow per level (a third of the body range at level 1, all of it and 1.48x stretched at level 5), capped by FULL_RANGE_SEC (0.7 s, a guess) so every gap is reachable.
- Level every 15 pipes, ELO per lap (start 1247), rep counting and knees-down give-up come from `../engine/`.
- Lives per mode (5/3/3/1, hearts in the panel): a pipe hit shows OUCH! -1 LIFE, flashes red, blinks the bird and costs that pipe's point. The last life kills the bird: it tumbles with YOU DIED for 1.2 s (`DEATH_SEC`), the video ends on the death, then the results. A run ends on the timer (win), STOP, a real give-up, or death.
- Give-up, live: knee visibility must reach 0.75 and stay above 0.45 for 3 s (take1: mid-set false alarms peaked at 0.69 and lasted up to 3.0 s; the real give-up peaked at 0.88 and lasted 8.2 s). Those 3 s are trimmed off the saved video, so it cuts at the give-up.
- Gaps: centres in the band the bird covers (plank to full push-up), swinging up to half of it at level 1 and all of it at level 5, capped so each gap stays reachable.
- Video: SAVE VIDEO writes the run to Photos, SHARE opens the iOS share sheet (ReplayKit records to an .mp4; the Simulator writes no file, so test saving on the phone).
- Replay any recorded take through the live game: `npx tsx ios-app/scripts/replay-take.ts pose/out/take1.landmarks.json 66.37` (from the repo root; fails if the run ends as a give-up before the real one).
- Timer runs out = win (confetti, starburst, trophy, level-up sound). STOP, knees down or death = LOSER stamp and a roast. Both show score, level, reps, hits, ELO before and after, calories as food, SAVE VIDEO, SHARE, AGAIN, MENU.
- Native part: `ios/PushCam/` (Swift: front camera, MediaPipe pose with `pose_landmarker_full.task`, sounds at 70%, ReplayKit recording; Objective-C glue for React Native).
- Not in yet: the boom zoom, face pass, music bed, 1080x1920 export with captions.

## Setup (once)

Needs Xcode 26.5 with its iOS 26.5 platform installed (Xcode > Settings > Components, or `xcodebuild -downloadPlatform iOS`), CocoaPods (`brew install cocoapods`), Node 22.11+.

```
npm install
cd ios && LANG=en_US.UTF-8 pod install
```

## Run on the iPhone

Release build (the JavaScript is bundled into the app, so it runs without the Mac):

```
cd ios
xcodebuild -workspace MobApp.xcworkspace -scheme MobApp -configuration Release \
  -destination 'id=00008150-001C705921BA401C' -derivedDataPath build -allowProvisioningUpdates
xcrun devicectl device install app --device E822BE0D-5CE2-5D50-9957-E2D65418A312 build/Build/Products/Release-iphoneos/MobApp.app
xcrun devicectl device process launch --device E822BE0D-5CE2-5D50-9957-E2D65418A312 com.furqanali.mobapp
```

Day-to-day development (live reload from the Mac; phone and Mac on the same Wi-Fi): `npm start`, then open `ios/MobApp.xcworkspace` in Xcode, pick the phone "Ali" and press Run.

## Checks

```
npm run typecheck
npx jest
```
