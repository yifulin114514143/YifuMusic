import { expect, test } from 'vite-plus/test';

import { themes } from '../lib/themes';

const REQUIRED_SEMANTIC_TOKENS = [
  '--main-color',
  '--link-color',
  '--surface-canvas',
  '--surface-raised',
  '--surface-sunken',
  '--surface-hover',
  '--surface-selected',
  '--text-primary',
  '--text-secondary',
  '--border-subtle',
  '--border-strong',
  '--accent',
  '--accent-contrast',
  '--accent-subtle',
  '--accent-border',
  '--focus-color',
  '--form-control-color',
  '--text-color',
  '--font-mono',
  '--radius-sm',
  '--radius-md',
  '--shadow-panel',
] as const;

const SOURCE_ALIGNED_TOKENS = {
  dark: {
    '--main-color': '#FF69B4',
    '--surface-canvas': '#121212',
    '--surface-raised': '#1a1a1a',
    '--surface-sunken': '#1d1d1d',
    '--surface-hover': '#363636',
    '--text-primary': '#e1e1e1',
    '--text-secondary': '#999999',
    '--border-subtle': '#333333',
    '--progress-bg': '#4a4a4a',
  },
  light: {
    '--main-color': '#FF69B4',
    '--surface-canvas': '#FFF0F5',
    '--surface-raised': '#ffffff',
    '--surface-sunken': '#FFE6F0',
    '--surface-hover': '#FFE9F2',
    '--text-primary': '#333333',
    '--text-secondary': '#777777',
    '--border-subtle': '#FFD9E6',
    '--progress-bg': '#FFD9E6',
  },
} as const;

function relativeLuminance(hexColor: string) {
  const rgb = [0, 2, 4].map(
    (offset) =>
      Number.parseInt(hexColor.slice(offset + 1, offset + 3), 16) / 255,
  );
  const [red, green, blue] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((first, second) => second - first);

  return (lighter + 0.05) / (darker + 0.05);
}

test('installed themes provide the Stage 4 semantic tokens', () => {
  Object.values(themes).forEach((theme) => {
    REQUIRED_SEMANTIC_TOKENS.forEach((token) => {
      expect(theme.variables).toHaveProperty(token);
    });
  });
});

test('theme surfaces follow the authorized MoeKoeMusic palette', () => {
  Object.entries(SOURCE_ALIGNED_TOKENS).forEach(([themeID, expectedTokens]) => {
    const theme = themes[themeID];

    Object.entries(expectedTokens).forEach(([token, expectedValue]) => {
      expect(theme.variables[token]).toBe(expectedValue);
    });
  });
});

test('filled emphasis follows the authorized white foreground and keyboard focus retains contrast', () => {
  Object.values(themes).forEach((theme) => {
    expect(theme.variables['--accent']).toBe('var(--main-color)');
    expect(theme.variables['--accent-contrast']).toBe('#ffffff');
    expect(
      contrastRatio(
        theme.variables['--focus-color'],
        theme.variables['--surface-canvas'],
      ),
    ).toBeGreaterThanOrEqual(3);
  });
});
