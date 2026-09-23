// Calories burned and what they equal in food.
//
// Burn: Compendium of Physical Activities (Ainsworth et al., 2011), code 02020 "calisthenics (e.g.
// push-ups, sit-ups, pull-ups, jumping jacks), vigorous effort" = 8.0 METs.
// kcal per minute = METs x 3.5 x body kg / 200 (the standard ACSM conversion).
//
// Food: nutrition-label values per item (USDA FoodData Central for fruit).

export const PUSHUP_METS = 8;

export const kcalBurned = (activeSec: number, weightKg: number) => ((PUSHUP_METS * 3.5 * weightKg) / 200) * (activeSec / 60);

export const FOODS = [
  { name: 'grape', plural: 'grapes', kcal: 3, emoji: '🍇' },
  { name: 'gummy bear', plural: 'gummy bears', kcal: 8, emoji: '🧸' },
  { name: 'Oreo', plural: 'Oreos', kcal: 53, emoji: '🍪' },
  { name: 'banana', plural: 'bananas', kcal: 105, emoji: '🍌' },
  { name: 'can of cola', plural: 'cans of cola', kcal: 140, emoji: '🥤' },
  { name: 'glazed donut', plural: 'glazed donuts', kcal: 190, emoji: '🍩' },
  { name: 'slice of pizza', plural: 'slices of pizza', kcal: 285, emoji: '🍕' },
  { name: 'Big Mac', plural: 'Big Macs', kcal: 590, emoji: '🍔' },
];

/** The biggest food you burned at least one of, e.g. "1.3 glazed donuts". */
export function foodEquivalent(kcal: number): string {
  const food = [...FOODS].reverse().find((f) => kcal >= f.kcal) ?? FOODS[0];
  const n = kcal / food.kcal;
  const count = n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
  return `${count} ${n >= 0.95 && n < 1.05 ? food.name : food.plural} ${food.emoji}`;
}

/** Daily goal on the menu's bar: one slice of pizza. */
export const DAILY_GOAL_KCAL = 285;

export function dailyRoast(kcal: number): string {
  if (kcal < 1) return 'Zero today. The couch is winning.';
  if (kcal < 50) return 'Mr. Donut Lover, you have a long way to go today.';
  if (kcal < 150) return 'Half a donut gone. The other half is laughing at you.';
  if (kcal < 285) return 'Almost a pizza slice. Do not stop now.';
  if (kcal < 500) return 'A whole pizza slice burned. Respect.';
  return 'Stop. You won today. Go eat something.';
}

/** Local calendar day, so the daily count resets at midnight. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
