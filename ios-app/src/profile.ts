// The player: name, avatar, weight, ELO and today's calories. Saved on the phone (UserDefaults through PushCam).

import { today } from './food';
import { PushCam } from './pushcam';

export type Avatar = { kind: 'emoji'; emoji: string; title: string; color: string } | { kind: 'photo'; file: string };

export interface Profile {
  name: string;
  avatar: Avatar;
  /** For the calorie estimate. */
  weightKg: number;
  elo: number;
  runs: number;
  /** Calories burned on a local calendar day; a new day starts from zero. */
  daily: { day: string; kcal: number };
}

export const todayKcal = (p: Profile) => (p.daily.day === today() ? p.daily.kcal : 0);

/** Chess-style ranks by ELO. */
export const RANKS = [
  { elo: 0, name: 'Wobbly Pawn', icon: '♟️' },
  { elo: 150, name: 'Knight in Sweaty Armor', icon: '🐴' },
  { elo: 250, name: 'Bishop of Biceps', icon: '⛪' },
  { elo: 400, name: 'Rook Solid', icon: '🏰' },
  { elo: 600, name: 'Queen of Gains', icon: '👑' },
  { elo: 900, name: 'Push-up Grandmaster', icon: '🏆' },
  { elo: 1300, name: 'Final Boss', icon: '💀' },
];

export const rankIndex = (elo: number) => RANKS.reduce((best, r, i) => (elo >= r.elo ? i : best), 0);
export const rankOf = (elo: number) => RANKS[rankIndex(elo)];
export const nextRank = (elo: number) => RANKS[rankIndex(elo) + 1] ?? null;

export const AVATARS: { emoji: string; title: string; color: string }[] = [
  { emoji: '🦍', title: 'Gym Gorilla', color: '#A98CFF' },
  { emoji: '🦖', title: 'T-Rex Arms', color: '#7CFF9B' },
  { emoji: '🥔', title: 'Couch Potato', color: '#FFC53D' },
  { emoji: '🐸', title: 'Frog Legs', color: '#35E0CF' },
  { emoji: '🐔', title: 'Chicken Wings', color: '#FF6FA8' },
  { emoji: '🦥', title: 'Sloth Mode', color: '#F4A98F' },
  { emoji: '🐷', title: 'Bacon Burner', color: '#FF6FA8' },
  { emoji: '🐙', title: 'Eight-Pack Octopus', color: '#FF5B4E' },
];

export const randomAvatar = (not?: string): Avatar => {
  const pool = AVATARS.filter((a) => a.emoji !== not);
  const a = pool[Math.floor(Math.random() * pool.length)];
  return { kind: 'emoji', ...a };
};

export async function loadProfile(): Promise<{ profile: Profile | null; docs: string }> {
  const r = await PushCam.loadProfile();
  return { profile: r.profile ? (JSON.parse(r.profile) as Profile) : null, docs: r.docs };
}

export const saveProfile = (p: Profile) => PushCam.saveProfile(JSON.stringify(p));
