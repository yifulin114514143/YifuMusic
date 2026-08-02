import { describe, expect, test } from 'vite-plus/test';

import { normalizeLanguage } from '../language';

describe('normalizeLanguage', () => {
  test('uses simplified Chinese for empty and invalid values', () => {
    expect(normalizeLanguage('')).toBe('zh-CN');
    expect(normalizeLanguage('  ')).toBe('zh-CN');
    expect(normalizeLanguage('de')).toBe('zh-CN');
  });

  test('retains supported persisted preferences', () => {
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('zh-CN')).toBe('zh-CN');
  });
});
