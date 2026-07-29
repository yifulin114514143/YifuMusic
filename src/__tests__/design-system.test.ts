import { expect, test } from 'vite-plus/test';

import { themes } from '../lib/themes';

const REQUIRED_SEMANTIC_TOKENS = [
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
  '--focus-color',
  '--radius-sm',
  '--radius-md',
  '--shadow-panel',
] as const;

test('installed themes provide the Stage 4 semantic tokens', () => {
  Object.values(themes).forEach((theme) => {
    REQUIRED_SEMANTIC_TOKENS.forEach((token) => {
      expect(theme.variables).toHaveProperty(token);
    });
  });
});
