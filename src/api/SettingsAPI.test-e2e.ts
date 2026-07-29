import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test';

import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config';

let getAccentContrast: typeof import('./SettingsAPI').getAccentContrast;

beforeEach(async () => {
  vi.stubGlobal('__MUSEEKS_INITIAL_CONFIG', MOCK_CONFIG);
  ({ getAccentContrast } = await import('./SettingsAPI'));
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('getAccentContrast', () => {
  test('chooses a readable black or white foreground for valid color input hex values', () => {
    expect(getAccentContrast('#000000')).toBe('#ffffff');
    expect(getAccentContrast('#ffffff')).toBe('#000000');
    expect(getAccentContrast('#808080')).toBe('#000000');
  });

  test('does not override the theme token for invalid or missing values', () => {
    expect(getAccentContrast(null)).toBeNull();
    expect(getAccentContrast('teal')).toBeNull();
    expect(getAccentContrast('#18b7b')).toBeNull();
  });
});
