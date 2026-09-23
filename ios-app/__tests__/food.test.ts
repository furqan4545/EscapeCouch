import { dailyRoast, foodEquivalent, kcalBurned } from '../src/food';

test('8 METs: a 75 kg body burns 10.5 kcal a minute', () => {
  expect(kcalBurned(60, 75)).toBeCloseTo(10.5);
  expect(kcalBurned(120, 100)).toBeCloseTo(28);
});

test('food equivalents use the biggest food burned', () => {
  expect(foodEquivalent(3)).toBe('1 grape 🍇');
  expect(foodEquivalent(21)).toBe('2.6 gummy bears 🧸');
  expect(foodEquivalent(250)).toBe('1.3 glazed donuts 🍩');
  expect(foodEquivalent(1180)).toBe('2 Big Macs 🍔');
});

test('low daily totals get roasted', () => {
  expect(dailyRoast(20)).toBe('Mr. Donut Lover, you have a long way to go today.');
});
