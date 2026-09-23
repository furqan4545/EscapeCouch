// First-run onboarding: welcome, name + weight, avatar (assigned or your own photo), starting ELO and
// the rank ladder. Also used to edit the profile from the menu. Jokey labels carry the plain meaning
// in brackets (owner, 23 Sep).

import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Svg from 'react-native-svg';
import { Bird, CREAM, FONT, INK, blinkAt } from './art';
import { START_ELO } from './game';
import { RANKS, randomAvatar, rankOf, type Avatar, type Profile } from './profile';
import { PushCam } from './pushcam';

const NAME_TAKES = ['Strong name.', 'Sounds like someone who skips leg day.', 'Future grandmaster detected.', 'The bird approves.', 'Kinda mid, but we move.', 'Your mom picked that, right?', 'That name has abs.', 'Villain origin story vibes.'];
const SCARED = ['Nobody is "just looking". Get in.', 'Too late. The bird saw you.', 'Your couch cannot protect you here.'];


/** Height of the on-screen keyboard (with its toolbar), 0 when hidden. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillChangeFrame', (e) => setHeight(Math.max(0, Dimensions.get('screen').height - e.endCoordinates.screenY)));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

const DONE_BAR_H = 52;

/**
 * Bar with DONE sitting on top of the keyboard whenever it is up, so there is always a visible button
 * to hide it. Render it once in a full-screen container.
 */
export function KeyboardDoneBar() {
  const keyboard = useKeyboardHeight();
  if (!keyboard) return null;
  return (
    <View style={[styles.doneBar, { bottom: keyboard }]}>
      <Text style={styles.doneHint}>or tap anywhere else</Text>
      <Pressable onPress={Keyboard.dismiss} style={styles.doneButton} hitSlop={10}>
        <Text style={styles.doneText}>DONE</Text>
      </Pressable>
    </View>
  );
}

/**
 * A page that never hides a field or a button under the keyboard: the content gets bottom padding the
 * height of the keyboard and its DONE bar, so it re-centres in the space above it and scrolls when it does not fit;
 * whenever the keyboard comes up the page scrolls to its bottom (the page's button, right under the
 * fields); a tap outside a field hides the keyboard.
 */
export function KeyboardPage({ children, centered = true, padded = true, stretch = false }: { children: React.ReactNode; centered?: boolean; padded?: boolean; stretch?: boolean }) {
  const keyboard = useKeyboardHeight();
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (keyboard > 0) setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 60);
  }, [keyboard, ref]);
  return (
    <ScrollView ref={ref} style={styles.fill} contentContainerStyle={[styles.scroll, padded && styles.padded, centered && styles.centered, { paddingBottom: 24 + (keyboard ? keyboard + DONE_BAR_H : 0) }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
      <Pressable onPress={Keyboard.dismiss} accessible={false} style={[styles.tapArea, stretch && styles.stretch]}>
        {children}
      </Pressable>
    </ScrollView>
  );
}

export function AvatarView({ avatar, docs, size }: { avatar: Avatar; docs: string; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size * 0.05) };
  if (avatar.kind === 'photo') {
    return <Image source={{ uri: `file://${docs}/${avatar.file}` }} style={[ring, styles.avatarBase]} />;
  }
  return (
    <View style={[ring, styles.avatarBase, { backgroundColor: avatar.color }]}>
      <Text style={{ fontSize: size * 0.56 }}>{avatar.emoji}</Text>
    </View>
  );
}

/** First run when `initial` is null; editing the profile otherwise (then CLOSE goes back to the menu without saving). */
export function Onboarding({ docs, initial, onDone, onCancel, onError }: { docs: string; initial: Profile | null; onDone: (p: Profile) => void; onCancel: () => void; onError: (message: string) => void }) {
  const [step, setStep] = useState(initial ? 1 : 0);
  const [name, setName] = useState(initial?.name ?? '');
  const [weight, setWeight] = useState(String(initial?.weightKg ?? 75));
  const [avatar, setAvatar] = useState<Avatar>(initial?.avatar ?? randomAvatar());
  const [scared, setScared] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }).start();
  }, [step, enter]);

  const next = () => {
    Keyboard.dismiss();
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => s - 1);
  const finish = () => onDone({ name: name.trim(), avatar, weightKg: Number(weight), elo: initial?.elo ?? START_ELO, runs: initial?.runs ?? 0, daily: initial?.daily ?? { day: '', kcal: 0 } });

  const slide = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        {step > (initial ? 1 : 0) ? (
          <Pressable onPress={back} hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ BACK</Text>
          </Pressable>
        ) : initial ? (
          <Pressable onPress={onCancel} hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>✕ CLOSE</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
          ))}
        </View>
        <View style={styles.back} />
      </View>
      <Animated.View style={[styles.fill, slide]}>
        {step === 0 && (
          <Welcome
            scared={scared}
            onGo={next}
            onScared={() => {
              setScared(SCARED[Math.floor(Math.random() * SCARED.length)]);
              setTimeout(next, 1400);
            }}
          />
        )}
        {step === 1 && <NameStep name={name} setName={setName} weight={weight} setWeight={setWeight} onNext={next} />}
        {step === 2 && <AvatarStep avatar={avatar} setAvatar={setAvatar} docs={docs} onError={onError} onNext={next} />}
        {step === 3 && <EloStep name={name.trim()} avatar={avatar} docs={docs} elo={initial?.elo ?? START_ELO} onDone={finish} />}
      </Animated.View>
      <KeyboardDoneBar />
    </View>
  );
}

function Welcome({ scared, onGo, onScared }: { scared: string | null; onGo: () => void; onScared: () => void }) {
  const { width } = useWindowDimensions();
  const bob = useRef(new Animated.Value(0)).current;
  const [sec, setSec] = useState(0);
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
    let raf = 0;
    let t0 = -1;
    const tick = (now: number) => {
      if (t0 < 0) t0 = now;
      setSec((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bob]);
  const birdW = Math.min(200, width * 0.48);
  return (
    <KeyboardPage>
      <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) }] }}>
        <Svg width={birdW} height={birdW * 0.86} viewBox="0 0 200 172">
          <Bird x={100} y={86} width={180} flap={Math.floor(sec * 9) % 3} blink={blinkAt(sec)} tilt={-8} />
        </Svg>
      </Animated.View>
      <Text style={styles.hero}>MOB</Text>
      <Text style={styles.lead}>The push-up game where your body is the joystick (the controller).</Text>
      <Text style={styles.small}>Side effects may include: arms (you get stronger).</Text>
      <Pressable style={styles.button} onPress={onGo}>
        <Text style={styles.buttonText}>LET'S GO</Text>
      </Pressable>
      <Pressable style={styles.link} onPress={onScared} disabled={scared !== null}>
        <Text style={styles.linkText}>{scared ?? "I'm just looking"}</Text>
      </Pressable>
    </KeyboardPage>
  );
}

function NameStep({ name, setName, weight, setWeight, onNext }: { name: string; setName: (s: string) => void; weight: string; setWeight: (s: string) => void; onNext: () => void }) {
  const weightRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const clean = name.trim();
  const kg = Number(weight);
  const kgOk = kg >= 30 && kg <= 250;
  const ok = clean.length > 0 && kgOk;
  const take = clean ? NAME_TAKES[[...clean].reduce((a, c) => a + c.charCodeAt(0), 0) % NAME_TAKES.length] : 'Type it. The bird is waiting.';
  return (
    <KeyboardPage>
      <Text style={styles.title}>What do we call you, champ?</Text>
      <Text style={styles.plain}>(your name)</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your gym name"
        placeholderTextColor="rgba(43, 22, 14, 0.4)"
        maxLength={14}
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => weightRef.current?.focus()}
       
        style={styles.input}
      />
      <Text style={styles.take}>{take}</Text>
      <Text style={[styles.title, styles.subTitle]}>How heavy is your heavy?</Text>
      <Text style={styles.plain}>(your weight)</Text>
      <View style={styles.weightRow}>
        <TextInput ref={weightRef} value={weight} onChangeText={setWeight} keyboardType="number-pad" maxLength={3} selectTextOnFocus style={[styles.input, styles.weightInput]} />
        <Text style={styles.weightUnit}>kg</Text>
      </View>
      <Text style={styles.small}>{kgOk ? 'We will not tell anyone. It is only for calories.' : 'Between 30 and 250 kg, please.'}</Text>
      <Pressable style={[styles.button, !ok && styles.disabled]} onPress={onNext} disabled={!ok}>
        <Text style={styles.buttonText}>NEXT</Text>
      </Pressable>
    </KeyboardPage>
  );
}

function AvatarStep({ avatar, setAvatar, docs, onError, onNext }: { avatar: Avatar; setAvatar: (a: Avatar) => void; docs: string; onError: (m: string) => void; onNext: () => void }) {
  const { width } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const reroll = () => {
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
    setAvatar(randomAvatar(avatar.kind === 'emoji' ? avatar.emoji : undefined));
  };
  const photo = () =>
    PushCam.pickPhoto().then(
      (file) => file && setAvatar({ kind: 'photo', file }),
      (e: Error) => onError(e.message),
    );
  return (
    <KeyboardPage>
      <Text style={styles.title}>{avatar.kind === 'photo' ? 'Look at you.' : 'The universe assigned you:'}</Text>
      <Text style={styles.plain}>{avatar.kind === 'photo' ? '(your photo)' : '(your avatar)'}</Text>
      <Animated.View style={{ marginTop: 14, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }, { scale: spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.7, 1] }) }] }}>
        <AvatarView avatar={avatar} docs={docs} size={Math.min(170, width * 0.42)} />
      </Animated.View>
      <Text style={styles.avatarTitle}>{avatar.kind === 'photo' ? 'Main Character Energy' : avatar.title}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.secondary]} onPress={reroll}>
          <Text style={styles.buttonText}>REROLL</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.pink]} onPress={photo}>
          <Text style={styles.buttonText}>MY PHOTO</Text>
        </Pressable>
      </View>
      <Pressable style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>THAT'S ME</Text>
      </Pressable>
    </KeyboardPage>
  );
}

function EloStep({ name, avatar, docs, elo, onDone }: { name: string; avatar: Avatar; docs: string; elo: number; onDone: () => void }) {
  const count = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = count.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(count, { toValue: elo, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => count.removeListener(id);
  }, [count, elo]);
  const rank = rankOf(elo);
  return (
    <KeyboardPage>
      <View style={styles.profileRow}>
        <AvatarView avatar={avatar} docs={docs} size={64} />
        <View style={styles.profileText}>
          <Text style={styles.profileName} numberOfLines={1}>{name}</Text>
          <Text style={styles.small}>{`Rank: ${rank.icon} ${rank.name}`}</Text>
        </View>
      </View>
      <Text style={styles.eloBig}>{`${shown}`}</Text>
      <Text style={styles.eloLabel}>ELO</Text>
      <Text style={styles.plain}>(your skill score)</Text>
      <Text style={styles.lead}>Clear levels to climb. Every level is +10 ELO, and +30 each after level 5 in one run.</Text>
      <Text style={styles.ladderTitle}>RANKS (by ELO)</Text>
      <View style={styles.ladder}>
        {[...RANKS].reverse().map((r) => (
          <View key={r.name} style={[styles.rung, r.name === rank.name && styles.rungOn]}>
            <Text style={styles.rungText} numberOfLines={1}>{`${r.icon}  ${r.name}`}</Text>
            <Text style={styles.rungElo}>{r.elo}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.button} onPress={onDone}>
        <Text style={styles.buttonText}>I'M READY</Text>
      </Pressable>
    </KeyboardPage>
  );
}

const outline = { textShadowColor: INK, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 1 };

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#3A1D12', paddingTop: 54 },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  padded: { paddingHorizontal: 22 },
  centered: { justifyContent: 'center' },
  tapArea: { alignItems: 'center', paddingVertical: 12 },
  stretch: { alignItems: 'stretch' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  back: { width: 76 },
  backText: { fontFamily: FONT, fontSize: 17, color: CREAM },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255, 231, 194, 0.3)' },
  dotOn: { backgroundColor: '#FFC53D', width: 28 },
  hero: { fontFamily: FONT, fontSize: 92, color: '#FFC53D', textShadowColor: INK, textShadowOffset: { width: 0, height: 8 }, textShadowRadius: 1 },
  title: { fontFamily: FONT, fontSize: 30, color: '#fff', textAlign: 'center', ...outline },
  subTitle: { fontSize: 24, marginTop: 24 },
  plain: { fontFamily: FONT, fontSize: 16, color: CREAM, opacity: 0.8, marginTop: 2 },
  lead: { fontFamily: FONT, fontSize: 19, color: CREAM, textAlign: 'center', marginTop: 10, ...outline },
  small: { fontFamily: FONT, fontSize: 15, color: CREAM, opacity: 0.85, marginTop: 6, textAlign: 'center' },
  input: { fontFamily: FONT, fontSize: 30, color: INK, backgroundColor: '#fff', borderRadius: 18, borderWidth: 4, borderColor: INK, alignSelf: 'stretch', textAlign: 'center', paddingVertical: 10, marginTop: 14 },
  take: { fontFamily: FONT, fontSize: 19, color: '#FF6FA8', marginTop: 12, textAlign: 'center', ...outline },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weightInput: { alignSelf: 'auto', minWidth: 120 },
  weightUnit: { fontFamily: FONT, fontSize: 28, color: '#fff', marginTop: 14 },
  avatarBase: { borderColor: INK, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: INK },
  avatarTitle: { fontFamily: FONT, fontSize: 28, color: '#FFC53D', marginTop: 12, textAlign: 'center', ...outline },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 12 },
  button: { marginTop: 18, backgroundColor: '#FFC53D', borderColor: INK, borderWidth: 4, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 26, alignItems: 'center' },
  secondary: { backgroundColor: '#35E0CF' },
  pink: { backgroundColor: '#FF6FA8' },
  disabled: { opacity: 0.4 },
  buttonText: { fontFamily: FONT, fontSize: 24, color: INK },
  link: { marginTop: 14, padding: 8 },
  linkText: { fontFamily: FONT, fontSize: 17, color: CREAM, textDecorationLine: 'underline', textAlign: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  profileText: { marginLeft: 14, flexShrink: 1 },
  profileName: { fontFamily: FONT, fontSize: 26, color: '#fff', ...outline },
  eloBig: { fontFamily: FONT, fontSize: 80, color: '#fff', marginTop: 8, textShadowColor: INK, textShadowOffset: { width: 0, height: 7 }, textShadowRadius: 1 },
  eloLabel: { fontFamily: FONT, fontSize: 22, color: CREAM, letterSpacing: 6, marginTop: -8 },
  ladderTitle: { fontFamily: FONT, fontSize: 16, color: '#fff', marginTop: 14, letterSpacing: 2 },
  ladder: { alignSelf: 'stretch', marginTop: 6 },
  rung: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10 },
  rungOn: { backgroundColor: 'rgba(255, 197, 61, 0.28)', borderWidth: 2, borderColor: '#FFC53D' },
  rungText: { fontFamily: FONT, fontSize: 16, color: '#fff', flexShrink: 1 },
  rungElo: { fontFamily: FONT, fontSize: 16, color: CREAM, marginLeft: 8 },
  doneBar: { position: 'absolute', left: 0, right: 0, height: DONE_BAR_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, backgroundColor: '#E9E4E0', paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#B8B2AD' },
  doneHint: { fontSize: 13, color: '#6B625C' },
  doneButton: { backgroundColor: '#FFC53D', borderRadius: 10, borderWidth: 3, borderColor: INK, paddingVertical: 6, paddingHorizontal: 16 },
  doneText: { fontFamily: FONT, fontSize: 18, color: INK },
});
