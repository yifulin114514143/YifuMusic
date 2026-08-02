import { describe, expect, test } from 'vite-plus/test';

import { formatBuildValue } from '../build-identity';

describe('formatBuildValue', () => {
  test('displays unavailable Git metadata as a Chinese unknown state', () => {
    expect(formatBuildValue('unknown')).toBe('未知');
    expect(formatBuildValue('')).toBe('未知');
  });
});
