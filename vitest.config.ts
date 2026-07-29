import os from 'node:os';

import { defineConfig } from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

import { VITE_TEST_PLUGINS } from './vite.config';

const BROWSER_OPTIMIZE_DEPS = [
  'react',
  'react-dom/client',
  'react/jsx-dev-runtime',
  '@lingui/core',
  '@lingui/react',
  '@base-ui/react/navigation-menu',
  '@base-ui/react/popover',
  '@base-ui/react/progress',
  '@base-ui/react/slider',
  '@base-ui/react/toast',
  '@dnd-kit/core',
  '@dnd-kit/modifiers',
  '@dnd-kit/sortable',
  '@dnd-kit/utilities',
  '@stylexjs/stylex',
  '@tanstack/react-query',
  '@tanstack/react-router',
  '@tanstack/react-virtual',
  '@tauri-apps/api/app',
  '@tauri-apps/api/core',
  '@tauri-apps/api/event',
  '@tauri-apps/api/menu',
  '@tauri-apps/api/window',
  '@tauri-apps/plugin-clipboard-manager',
  '@tauri-apps/plugin-dialog',
  '@tauri-apps/plugin-fs',
  '@tauri-apps/plugin-log',
  '@tauri-apps/plugin-notification',
  '@tauri-apps/plugin-opener',
  'eventemitter3',
  'lodash-es/debounce',
  'lodash-es/orderBy',
  'lodash-es/uniq',
  'react-keybinding-component',
  'semver',
  'zustand',
  'vitest-browser-react',
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['**/*.test-e2e.ts', '**/*.test-e2e.tsx'],
          includeTaskLocation: true,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            ui: false,
            viewport: {
              width: 900,
              height: 500,
            },

            // https://vitest.dev/guide/browser/playwright
            // ideally, 'webkit' or 'safari', but there are potential issues with the Audio API
            instances: [{ browser: 'chromium' }],
          },
          env: {
            PLATFORM: getTauriPlatform(),
          },
        },
        plugins: VITE_TEST_PLUGINS,
        optimizeDeps: {
          noDiscovery: true,
          include: BROWSER_OPTIMIZE_DEPS,
        },
        publicDir: 'src/__tests__/assets',
      },
    ],
  },
  optimizeDeps: {
    noDiscovery: true,
    include: BROWSER_OPTIMIZE_DEPS,
  },
});

function getTauriPlatform() {
  switch (os.platform()) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}
