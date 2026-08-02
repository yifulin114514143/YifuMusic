import { expect, test } from 'vite-plus/test';

import { themes } from '../lib/themes';

const REQUIRED_SEMANTIC_TOKENS = [
  '--main-color',
  '--main-color-light',
  '--main-color-deep',
  '--accent-pink',
  '--link-color',
  '--surface-canvas',
  '--surface-base',
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
  '--glass-surface',
  '--glass-surface-solid',
  '--glass-backdrop-filter-soft',
  '--glass-backdrop-filter-strong',
  '--glass-highlight',
] as const;

const SOURCE_ALIGNED_TOKENS = {
  dark: {
    '--main-color': '#7C5CFF',
    '--surface-canvas': '#0B0E16',
    '--surface-raised': '#161522',
    '--surface-sunken': '#10131C',
    '--surface-hover': '#252033',
    '--text-primary': '#F4F3FF',
    '--text-secondary': '#A5A8B8',
    '--border-subtle': 'rgba(255, 255, 255, 0.12)',
    '--progress-bg': '#373145',
  },
  light: {
    '--main-color': '#7C5CFF',
    '--surface-canvas': '#F5F6FF',
    '--surface-raised': '#FFFFFF',
    '--surface-sunken': '#ECEBFA',
    '--surface-hover': '#E5E2FF',
    '--text-primary': '#232034',
    '--text-secondary': '#625E76',
    '--border-subtle': 'rgba(80, 68, 136, 0.16)',
    '--progress-bg': '#D9D3F1',
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

test('theme surfaces follow the YifuMusic ether purple palette', () => {
  Object.entries(SOURCE_ALIGNED_TOKENS).forEach(([themeID, expectedTokens]) => {
    const theme = themes[themeID];

    Object.entries(expectedTokens).forEach(([token, expectedValue]) => {
      expect(theme.variables[token]).toBe(expectedValue);
    });
  });
});

test('themes provide glass surfaces with solid fallbacks', () => {
  Object.values(themes).forEach((theme) => {
    expect(theme.variables['--glass-surface']).toContain('rgba');
    expect(theme.variables['--glass-surface-solid']).toBe(
      'var(--surface-raised)',
    );
    expect(theme.variables['--glass-backdrop-filter-soft']).toContain(
      'blur(16px)',
    );
    expect(theme.variables['--glass-backdrop-filter-strong']).toContain(
      'blur(24px)',
    );
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
