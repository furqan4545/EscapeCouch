/**
 * The push-up game. First launch: onboarding (name, weight, avatar, 100 ELO). Then pick a difficulty
 * and a timer, press START, get in plank: after a 3-2-1 your body flies the bird. Every 15 pipes is a
 * level and earns ELO. The timer running out is a win; STOP, knees down (giving up) or losing your last
 * life to a pipe gets you roasted.
 * Calories go into today's total. The run is recorded so it can be saved and posted.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { G, Polygon, Rect } from 'react-native-svg';
import { AVATAR_CY, AVATAR_D, Bird, blinkAt, CREAM, FONT, GameText, INK, LevelUp, PANEL_CX, PipeDefs, PipePair, PlayerPanel, levelColor } from './src/art';
import { DAILY_GOAL_KCAL, dailyRoast, foodEquivalent, kcalBurned, today } from './src/food';
import { BIRD_W, BIRD_X, COUNTDOWNS, DEATH_SEC, MODES, WORLD_W, eloNow, laps, level, newGame, onPose, step, stop, tilt, timeLeft, type Game } from './src/game';
import { AvatarView, KeyboardDoneBar, KeyboardPage, Onboarding } from './src/Onboarding';
import { loadProfile, nextRank, rankOf, saveProfile, todayKcal, type Profile } from './src/profile';
import { CameraView, PushCam, onError, onPose as onPoseEvent } from './src/pushcam';

const TIMERS = [1, 2, 3, 10];
const ROASTS = ['Your couch missed you', 'Grandma does more push-ups', 'Noodle arms confirmed', 'The bird is embarrassed for you', 'Quitting is not cardio', 'Even the pipes felt bad'];
const PRAISE = ['Built different', 'Absolute unit', 'The bird salutes you', 'Certified push-up machine'];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** What the results screen shows: the profile before and after the run, and the run's calories. */
interface RunResult {
  before: Profile;
  after: Profile;
  kcal: number;
}

function App() {
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const k = screenW / WORLD_W;
  const worldH = screenH / k;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [docs, setDocs] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const profileRef = useRef<Profile | null>(null);
  const [modeI, setModeI] = useState(1);
  const [minutes, setMinutes] = useState(2);
  const [customOn, setCustomOn] = useState(false);
  const [custom, setCustom] = useState('5');
  const [countdown, setCountdown] = useState(5);
  const game = useRef<Game>(newGame(worldH, 'home', MODES[1], 120, 0));
  const [, setFrame] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  /** off: no recording; on: recording the run; ready: the run's video is ready to save or share. */
  const [recording, setRecordingState] = useState<'off' | 'on' | 'ready'>('off');
  // Mirrors `recording` for the camera and frame callbacks, which were created once on mount.
  const recordingRef = useRef<'off' | 'on' | 'ready'>('off');
  const setRecording = (r: 'off' | 'on' | 'ready') => {
    recordingRef.current = r;
    setRecordingState(r);
  };
  const [result, setResult] = useState<RunResult | null>(null);
  const clockT = useRef(0);

  const report = (message: string) => setErrors((e) => [...e.slice(-2), message]);

  const keep = (p: Profile) => {
    profileRef.current = p;
    setProfile(p);
    saveProfile(p);
  };

  const endRun = () => {
    // Only stop a recording that is running: if iOS refused to start it, that error is already shown.
    if (recordingRef.current === 'on') {
      PushCam.stopRecording(game.current.cutBackSec).then(
        () => setRecording('ready'),
        (e: Error) => {
          setRecording('off');
          report(e.message);
        },
      );
    }
    const before = profileRef.current!;
    const g = game.current;
    const kcal = kcalBurned(g.t, before.weightKg);
    const after: Profile = { ...before, elo: eloNow(g), runs: before.runs + 1, daily: { day: today(), kcal: todayKcal(before) + kcal } };
    keep(after);
    setResult({ before, after, kcal });
  };

  useEffect(() => {
    loadProfile().then(
      (r) => {
        profileRef.current = r.profile;
        setProfile(r.profile);
        setDocs(r.docs);
      },
      (e: Error) => report(`Could not load your profile: ${e.message}`),
    );
    const pose = onPoseEvent((ev) => {
      const r = onPose(game.current, ev, { screenW, screenH });
      if (r.end) endRun();
    });
    const err = onError((e) => report(e.message));
    return () => {
      pose.remove();
      err.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The camera starts once the player has a profile (so the permission prompt comes after onboarding).
  const hasProfile = profile !== null;
  useEffect(() => {
    if (hasProfile) PushCam.start();
  }, [hasProfile]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      clockT.current += dt;
      const r = step(game.current, dt);
      r.sfx.forEach((s) => PushCam.play(s));
      if (r.end) endRun();
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (docs === null) return <View style={styles.root} />;
  if (profile === null || editing) {
    return (
      <View style={styles.root}>
        <StatusBar hidden />
        <Onboarding
          docs={docs}
          initial={profile}
          onDone={(p) => {
            keep(p);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onError={report}
        />
        <Errors errors={errors} onClear={() => setErrors([])} />
      </View>
    );
  }

  const runMinutes = customOn ? Number(custom) : minutes;

  const startRun = () => {
    if (!(runMinutes >= 1 && runMinutes <= 120)) {
      report('Custom timer: type a number of minutes from 1 to 120');
      return;
    }
    const run = newGame(worldH, 'ready', MODES[modeI], Math.round(runMinutes * 60), profile.elo, countdown);
    game.current = run;
    setResult(null);
    setRecording('off');
    PushCam.startRecording().then(
      () => {
        // iOS asks permission first: if the run already ended meanwhile, this recording has nothing in it.
        if (game.current === run && run.phase !== 'over') setRecording('on');
        else PushCam.stopRecording(0).catch((e: Error) => report(e.message));
      },
      (e: Error) => report(`Recording is off, so this run has no video: ${e.message}`),
    );
  };

  const toMenu = () => {
    game.current = newGame(worldH, 'home', MODES[modeI], 120, profile.elo);
    setResult(null);
    setRecording('off');
  };

  const g = game.current;
  const lvl = level(g);
  const flap = Math.floor(clockT.current * 9) % 3;
  const blink = blinkAt(clockT.current);
  const hitFlash = g.phase === 'play' ? Math.max(0, 0.35 * (1 - (g.t - g.hitAt) / 0.3)) : 0;
  const px = (v: number) => v * k;
  const inRun = g.phase === 'ready' || g.phase === 'play' || g.phase === 'dying';
  const readyLeft = g.countdownSec - g.readyT;
  const sinceHit = g.t - g.hitAt;
  // After a hit the bird blinks for 0.6 s; when it dies it tumbles.
  const birdOpacity = g.phase === 'play' && sinceHit < 0.6 && Math.floor(sinceHit * 12) % 2 === 0 ? 0.25 : 1;
  const birdTilt = g.phase === 'dying' ? (g.t - g.diedAt) * 720 : tilt(g);
  const rank = rankOf(profile.elo);
  const next = nextRank(profile.elo);
  const daily = todayKcal(profile);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <CameraView style={StyleSheet.absoluteFill} />

      {inRun && (
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${WORLD_W} ${worldH}`}>
          <PipeDefs />
          {g.pipes.map((p) => (
            <PipePair key={p.k} left={p.x} gapTop={p.gapTop} gapBottom={p.gapBottom} worldH={worldH} hit={p.hit} />
          ))}
          <G opacity={birdOpacity}>
            <Bird x={BIRD_X} y={g.birdY} width={BIRD_W} flap={g.phase === 'dying' ? 1 : flap} blink={g.phase === 'dying' ? 1 : blink} tilt={birdTilt} />
          </G>
          <PlayerPanel name={profile.name} startElo={g.startElo} score={g.score} level={lvl} laps={laps(g)} lives={g.lives} maxLives={g.mode.lives} reps={g.reps} timeLeft={timeLeft(g)} sincePass={g.t - g.passAt} sinceLevel={g.t - g.levelUpAt} flap={flap} blink={blink} />
          {g.phase === 'play' && <LevelUp level={lvl} since={g.t - g.levelUpAt} worldH={worldH} />}
          {hitFlash > 0 && <Rect x={0} y={0} width={WORLD_W} height={worldH} fill="#FF3B30" opacity={hitFlash} />}
          {g.phase === 'play' && sinceHit < 0.8 && (
            <GameText x={540} y={worldH * 0.88} size={70} fill="#FF5B4E" outline={8} shadow={6} opacity={1 - Math.max(0, sinceHit - 0.5) / 0.3}>OUCH! -1 LIFE</GameText>
          )}
          {g.phase === 'dying' && (
            <G opacity={Math.min(1, (g.t - g.diedAt) / 0.2)}>
              <Rect x={0} y={0} width={WORLD_W} height={worldH} fill="#000" opacity={0.35 * Math.min(1, (g.t - g.diedAt) / DEATH_SEC)} />
              <GameText x={540} y={worldH * 0.86} size={120} fill="#FF5B4E" outline={11} shadow={10}>YOU DIED</GameText>
            </G>
          )}
          {g.phase === 'ready' && (
            <G>
              <GameText x={540} y={worldH * 0.72} size={64} fill="#fff" outline={7} shadow={6}>{readyLeft > 1 ? 'GET ON THE FLOOR' : 'HOLD PLANK'}</GameText>
              <GameText x={540} y={worldH * 0.72 + 52} size={30} fill={CREAM} outline={5} shadow={3}>{readyLeft > 1 ? '(get in push-up position, arms straight)' : '(calibrating: measuring how far you are)'}</GameText>
              {readyLeft > 0 && <GameText x={540} y={worldH * 0.72 + 160} size={110} fill="#FFC53D" outline={9} shadow={7}>{Math.ceil(readyLeft)}</GameText>}
              <GameText x={540} y={worldH * 0.72 + 235} size={34} fill={g.tracked ? '#7CFF9B' : '#FF6FA8'} outline={5} shadow={4}>
                {g.tracked ? (readyLeft > 0 ? 'Body found' : 'Hold still...') : 'Step back: shoulders in frame'}
              </GameText>
            </G>
          )}
        </Svg>
      )}

      {inRun && (
        <View style={{ position: 'absolute', left: px(PANEL_CX - AVATAR_D / 2 + 7), top: px(AVATAR_CY - AVATAR_D / 2 + 7) }}>
          <AvatarView avatar={profile.avatar} docs={docs} size={px(AVATAR_D - 14)} />
        </View>
      )}

      {g.phase === 'home' && (
        <View style={styles.menu}>
          <KeyboardPage centered={false} padded={false} stretch>
            <View style={styles.menuInner}>
            <View style={styles.me}>
              <AvatarView avatar={profile.avatar} docs={docs} size={64} />
              <View style={styles.meText}>
                <Text style={styles.meName} numberOfLines={1}>{profile.name}</Text>
                <Text style={styles.meRank} numberOfLines={1}>{`Rank: ${rank.icon} ${rank.name}`}</Text>
                <Text style={styles.meElo}>{next ? `ELO ${profile.elo}  ·  ${next.elo - profile.elo} to ${next.name}` : `ELO ${profile.elo}  ·  top rank`}</Text>
              </View>
              <Pressable onPress={() => setEditing(true)} style={styles.edit}>
                <Text style={styles.editText}>EDIT</Text>
              </Pressable>
            </View>
            <View style={styles.today}>
              <Text style={styles.todayTitle}>{`🔥 TODAY: ${Math.round(daily)} kcal`}</Text>
              <Text style={styles.plainMenu}>{daily >= 3 ? `(calories burned today = ${foodEquivalent(daily)})` : '(calories burned today)'}</Text>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.min(100, (daily / DAILY_GOAL_KCAL) * 100)}%` }]} />
              </View>
              <Text style={styles.todayRoast}>{dailyRoast(daily)}</Text>
            </View>

            <Text style={styles.title}>PICK YOUR PAIN</Text>
            <Text style={[styles.plainMenu, styles.center]}>(difficulty)</Text>
            {MODES.map((m, i) => (
              <Pressable key={m.name} onPress={() => setModeI(i)} style={[styles.card, i === modeI && { borderColor: levelColor(i + 1), backgroundColor: 'rgba(255, 255, 255, 0.14)' }]}>
                <Text style={[styles.cardName, { color: levelColor(i + 1) }]}>{m.name}</Text>
                <Text style={styles.cardBlurb}>{m.blurb}</Text>
              </Pressable>
            ))}
            <Text style={styles.section}>TIMER <Text style={styles.plainMenu}>(how long the run lasts)</Text></Text>
            <View style={styles.chips}>
              {TIMERS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setMinutes(t);
                    setCustomOn(false);
                  }}
                  style={[styles.chip, !customOn && minutes === t && styles.chipOn]}>
                  <Text style={[styles.chipText, !customOn && minutes === t && styles.chipTextOn]}>{`${t} MIN`}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setCustomOn(true)} style={[styles.chip, customOn && styles.chipOn]}>
                <Text style={[styles.chipText, customOn && styles.chipTextOn]}>CUSTOM</Text>
              </Pressable>
            </View>
            {customOn && (
              <View style={styles.customRow}>
                <TextInput value={custom} onChangeText={setCustom} keyboardType="number-pad" maxLength={3} style={styles.customInput} selectTextOnFocus />
                <Text style={styles.cardBlurb}>minutes</Text>
              </View>
            )}
            <Text style={styles.section}>GET READY <Text style={styles.plainMenu}>(seconds to get on the floor)</Text></Text>
            <View style={styles.chips}>
              {COUNTDOWNS.map((s) => (
                <Pressable key={s} onPress={() => setCountdown(s)} style={[styles.chip, countdown === s && styles.chipOn]}>
                  <Text style={[styles.chipText, countdown === s && styles.chipTextOn]}>{`${s} SEC`}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.button} onPress={startRun}>
              <Text style={styles.buttonText}>START</Text>
            </Pressable>
            <Text style={styles.hint}>Phone on the floor, front camera facing you, about 1 m away.</Text>
            </View>
          </KeyboardPage>
        </View>
      )}

      {g.phase === 'over' && result && (
        <Result
          key={g.id}
          g={g}
          result={result}
          screenW={screenW}
          screenH={screenH}
          video={recording}
          onError={report}
          onAgain={startRun}
          onMenu={toMenu}
        />
      )}

      {(g.phase === 'ready' || g.phase === 'play') && (
        <Pressable
          style={styles.stop}
          onPress={() => {
            stop(game.current);
            endRun();
          }}>
          <Text style={styles.stopText}>STOP</Text>
        </Pressable>
      )}

      <KeyboardDoneBar />
      <Errors errors={errors} onClear={() => setErrors([])} />
    </View>
  );
}

function Errors({ errors, onClear }: { errors: string[]; onClear: () => void }) {
  if (!errors.length) return null;
  return (
    <Pressable style={styles.errors} onPress={onClear}>
      {errors.map((e, i) => (
        <Text key={i} style={styles.errorText}>{e}</Text>
      ))}
    </Pressable>
  );
}

/** End of run: a win (timer ran out) gets confetti, a starburst and a trophy; anything else gets roasted. */
function Result({ g, result, screenW, screenH, video, onError, onAgain, onMenu }: { g: Game; result: RunResult; screenW: number; screenH: number; video: 'off' | 'on' | 'ready'; onError: (m: string) => void; onAgain: () => void; onMenu: () => void }) {
  const [save, setSave] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveVideo = () => {
    setSave('saving');
    PushCam.saveRecording().then(
      () => setSave('saved'),
      (e: Error) => {
        setSave('idle');
        onError(e.message);
      },
    );
  };
  const won = g.endReason === 'time up';
  const line = useMemo(() => pick(won ? PRAISE : ROASTS), [won]);
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const left = clock(timeLeft(g));
  const { before, after, kcal } = result;
  const gain = after.elo - before.elo;
  const rankUp = rankOf(after.elo).name !== rankOf(before.elo).name ? rankOf(after.elo) : null;
  const daily = todayKcal(after);

  useEffect(() => {
    PushCam.play(won ? 'levelup.wav' : 'boom.wav');
    Animated.spring(pop, { toValue: 1, friction: won ? 4 : 5, tension: 140, useNativeDriver: true }).start();
    if (!won) {
      const jolt = (v: number) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true });
      Animated.sequence([Animated.delay(250), jolt(1), jolt(-1), jolt(1), jolt(0)]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const why = won
    ? `${clock(g.durationSec)} of ${g.mode.name}. Done.`
    : g.endReason === 'stopped'
      ? `Quit with ${left} still on the clock`
      : g.endReason === 'died'
        ? `You crashed into ${g.hits} ${g.hits === 1 ? 'pipe' : 'pipes'} and died with ${left} left`
        : `Knees touched the floor (you gave up) with ${left} left`;
  const burn = kcal >= 1 ? `🔥 ${Math.round(kcal)} kcal  =  ${foodEquivalent(kcal)}` : '🔥 0 kcal. Not even a grape.';
  const titleScale = won ? pop : pop.interpolate({ inputRange: [0, 1], outputRange: [3, 1] });
  const titleRotate = won ? '0deg' : shake.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '-2deg'] });

  return (
    <View style={styles.result}>
      {won && <Starburst size={Math.max(screenW, screenH) * 1.3} />}
      {won && <Confetti width={screenW} height={screenH} />}
      <ScrollView style={styles.fill} contentContainerStyle={styles.resultInner} showsVerticalScrollIndicator={false}>
      {won ? <Trophy /> : <Text style={styles.chicken}>🐔</Text>}
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={[styles.bigTitle, { color: won ? '#FFC53D' : '#FF5B4E', transform: [{ scale: titleScale }, { rotate: titleRotate }] }]}>
        {won ? 'YOU SURVIVED!' : 'LOSER'}
      </Animated.Text>
      {won && <Text style={styles.plainResult}>(the timer ran out: you win)</Text>}
      <Text style={styles.why}>{why}</Text>
      <Text style={styles.line}>{line}</Text>
      <View style={styles.statsBox}>
        <Text style={styles.stats}>{`SCORE ${g.score}   LEVEL ${level(g)}   REPS ${g.reps}   HITS ${g.hits}`}</Text>
        <Text style={styles.stats}>{`ELO ${before.elo} → ${after.elo}  (+${gain})`}</Text>
        {rankUp && <Text style={styles.rankUp}>{`RANK UP! ${rankUp.icon} ${rankUp.name}`}</Text>}
        <Text style={[styles.stats, styles.burn]}>{burn}</Text>
        <Text style={styles.todayLine}>{`Today: ${Math.round(daily)} kcal. ${dailyRoast(daily)}`}</Text>
      </View>
      <View style={styles.row}>
        {video === 'ready' && (
          <Pressable style={[styles.button, styles.secondary, save !== 'idle' && styles.done]} onPress={saveVideo} disabled={save !== 'idle'}>
            <Text style={styles.buttonText}>{save === 'idle' ? 'SAVE VIDEO' : save === 'saving' ? 'SAVING...' : 'SAVED ✓'}</Text>
          </Pressable>
        )}
        {video === 'ready' && (
          <Pressable style={[styles.button, styles.pinkButton]} onPress={() => PushCam.shareRecording().catch((e: Error) => onError(e.message))}>
            <Text style={styles.buttonText}>SHARE</Text>
          </Pressable>
        )}
        <Pressable style={styles.button} onPress={onAgain}>
          <Text style={styles.buttonText}>AGAIN</Text>
        </Pressable>
      </View>
      <Pressable style={[styles.button, styles.ghost]} onPress={onMenu}>
        <Text style={[styles.buttonText, { color: '#fff' }]}>MENU</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

/** Slowly turning sun rays behind the win screen. */
function Starburst({ size }: { size: number }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(turn, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [turn]);
  const rays = 16;
  const c = size / 2;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, opacity: 0.35, transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={size} height={size}>
        {Array.from({ length: rays }, (_, i) => {
          const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 0.5) / rays) * Math.PI * 2;
          return <Polygon key={i} points={`${c},${c} ${c + c * Math.cos(a0)},${c + c * Math.sin(a0)} ${c + c * Math.cos(a1)},${c + c * Math.sin(a1)}`} fill={i % 2 ? '#FFC53D' : '#FF6FA8'} />;
        })}
      </Svg>
    </Animated.View>
  );
}

function Trophy() {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, [bounce]);
  return <Animated.Text style={[styles.trophy, { transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }, { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }]}>🏆</Animated.Text>;
}

const CONFETTI_COLORS = ['#FFC53D', '#35E0CF', '#FF6FA8', '#A98CFF', '#FF5B4E', '#7CFF9B'];

function Confetti({ width, height }: { width: number; height: number }) {
  const pieces = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({ x: Math.random() * width, delay: Math.random() * 1400, dur: 1800 + Math.random() * 1600, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], size: 8 + Math.random() * 10, fall: new Animated.Value(0) })),
    [width],
  );
  useEffect(() => {
    pieces.forEach((p) => Animated.loop(Animated.sequence([Animated.delay(p.delay), Animated.timing(p.fall, { toValue: 1, duration: p.dur, easing: Easing.linear, useNativeDriver: true })])).start());
  }, [pieces]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -30,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: [
              { translateY: p.fall.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
              { rotate: p.fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${540 + i * 20}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

const outline = { textShadowColor: INK, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 1 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  menu: { position: 'absolute', left: 14, right: 14, top: 54, bottom: 30, backgroundColor: 'rgba(43, 22, 14, 0.88)', borderRadius: 26, borderWidth: 4, borderColor: INK },
  menuInner: { paddingHorizontal: 16, paddingTop: 6 },
  fill: { flex: 1, alignSelf: 'stretch' },
  center: { textAlign: 'center' },
  plainMenu: { fontFamily: FONT, fontSize: 14, color: CREAM, opacity: 0.8, letterSpacing: 0 },
  plainResult: { fontFamily: FONT, fontSize: 16, color: CREAM, opacity: 0.85, marginTop: 4, textAlign: 'center' },
  me: { flexDirection: 'row', alignItems: 'center' },
  meText: { flex: 1, marginLeft: 12 },
  meName: { fontFamily: FONT, fontSize: 26, color: '#fff', ...outline },
  meRank: { fontFamily: FONT, fontSize: 16, color: '#FFC53D' },
  meElo: { fontFamily: FONT, fontSize: 14, color: CREAM, marginTop: 2 },
  edit: { borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.35)', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
  editText: { fontFamily: FONT, fontSize: 14, color: '#fff' },
  today: { marginTop: 14, backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: 12 },
  todayTitle: { fontFamily: FONT, fontSize: 18, color: '#fff' },
  bar: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.15)', marginTop: 8, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6, backgroundColor: '#FF5B4E' },
  todayRoast: { fontFamily: FONT, fontSize: 15, color: '#FF6FA8', marginTop: 8 },
  title: { fontFamily: FONT, fontSize: 38, color: '#FFC53D', textAlign: 'center', marginTop: 18, marginBottom: 4, ...outline },
  card: { borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.18)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16, marginTop: 10 },
  cardName: { fontFamily: FONT, fontSize: 28, ...outline },
  cardBlurb: { fontFamily: FONT, fontSize: 17, color: CREAM, marginTop: 2 },
  section: { fontFamily: FONT, fontSize: 24, color: '#fff', marginTop: 22, letterSpacing: 3, ...outline },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 13 },
  chipOn: { backgroundColor: '#FFC53D', borderColor: INK },
  chipText: { fontFamily: FONT, fontSize: 18, color: '#fff' },
  chipTextOn: { color: INK },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  customInput: { fontFamily: FONT, fontSize: 28, color: INK, backgroundColor: '#fff', borderRadius: 12, borderWidth: 3, borderColor: INK, minWidth: 90, paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center' },
  hint: { fontFamily: FONT, fontSize: 15, color: CREAM, textAlign: 'center', marginTop: 14, opacity: 0.85 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, justifyContent: 'center' },
  button: { marginTop: 18, backgroundColor: '#FFC53D', borderColor: INK, borderWidth: 4, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center' },
  secondary: { backgroundColor: '#35E0CF' },
  pinkButton: { backgroundColor: '#FF6FA8' },
  done: { backgroundColor: '#7CFF9B' },
  ghost: { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: '#fff', marginTop: 12 },
  buttonText: { fontFamily: FONT, fontSize: 24, color: INK },
  // Bottom-right corner: inside the right-hand strip where the face never goes.
  stop: { position: 'absolute', right: 16, bottom: 40, backgroundColor: '#FF5B4E', borderColor: INK, borderWidth: 4, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 22 },
  stopText: { fontFamily: FONT, fontSize: 26, color: '#fff' },
  result: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20, 10, 6, 0.85)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  resultInner: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 30 },
  bigTitle: { alignSelf: 'stretch', fontFamily: FONT, fontSize: 72, textAlign: 'center', textShadowColor: INK, textShadowOffset: { width: 0, height: 7 }, textShadowRadius: 1 },
  trophy: { fontSize: 90 },
  chicken: { fontSize: 72 },
  why: { fontFamily: FONT, fontSize: 21, color: '#fff', textAlign: 'center', marginTop: 8, ...outline },
  line: { fontFamily: FONT, fontSize: 24, color: '#FF6FA8', textAlign: 'center', marginTop: 6, ...outline },
  statsBox: { marginTop: 16, alignItems: 'center' },
  stats: { fontFamily: FONT, fontSize: 21, color: '#fff', marginTop: 6, textAlign: 'center', ...outline },
  rankUp: { fontFamily: FONT, fontSize: 24, color: '#7CFF9B', marginTop: 8, textAlign: 'center', ...outline },
  burn: { fontSize: 23, color: '#FFC53D' },
  todayLine: { fontFamily: FONT, fontSize: 16, color: CREAM, marginTop: 6, textAlign: 'center', ...outline },
  errors: { position: 'absolute', left: 12, right: 12, bottom: 8, backgroundColor: 'rgba(180, 20, 20, 0.9)', borderRadius: 10, padding: 10 },
  errorText: { color: '#fff', fontSize: 13 },
});

export default App;
