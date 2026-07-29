import { describe, expect, test } from 'vite-plus/test';

import { getEffectiveDuration, normalizeSeekTime } from '../player-contract';

describe('player media contract', () => {
  test('uses database duration only before metadata is loaded', () => {
    expect(getEffectiveDuration(120, null, false)).toBe(120);
    expect(getEffectiveDuration(120, 150, true)).toBe(150);
    expect(
      getEffectiveDuration(120, Number.POSITIVE_INFINITY, true),
    ).toBeNull();
    expect(getEffectiveDuration(120, Number.NaN, true)).toBeNull();
  });

  test('rejects invalid seek values and clamps known duration', () => {
    expect(normalizeSeekTime(Number.NaN, 100, 120)).toBeNull();
    expect(normalizeSeekTime(Number.POSITIVE_INFINITY, 100, 120)).toBeNull();
    expect(normalizeSeekTime(-1, 100, 120)).toBeNull();
    expect(normalizeSeekTime(140, 100, 120)).toBe(100);
    expect(normalizeSeekTime(140, null, 120)).toBe(120);
    expect(normalizeSeekTime(140, null, null)).toBe(140);
  });
});
