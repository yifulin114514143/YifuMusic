import { i18n } from '@lingui/core';
import { afterEach, beforeEach, expect, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-react';
import { cleanup } from 'vitest-browser-react';
import { page } from 'vitest/context';

import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config.ts';
import { messages } from '../translations/zh-CN.po';

type Whatever = () => void | Promise<void>;
type SetupOptions = {
  width?: number;
  height?: number;
  navigationMode?: 'side' | 'top' | null;
  sidebarCollapsed?: boolean;
};

const E2E_MOCKED_MODULES = [
  '../lib/bridge-database',
  '../lib/bridge-config',
  '../lib/cover',
  '../lib/bridge-media-controls',
  '../lib/bridge-native-audio',
  '../lib/bridge-desktop-lyrics',
  '../lib/bridge-lyrics',
  '../lib/bridge-tray',
] as const;

/**
 * E2E test setup, stubbing globals, bridges, setting up i18n and rendering the app
 */
export function beforeEachSetup(options?: SetupOptions) {
  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
    for (const modulePath of E2E_MOCKED_MODULES) {
      vi.doUnmock(modulePath);
    }
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  beforeEach(async () => {
    vi.resetModules();

    if (options?.width !== undefined && options.height !== undefined) {
      await page.viewport(options.width, options.height);
    }

    window.localStorage.clear();
    window.sessionStorage.clear();
    if (options?.navigationMode !== null) {
      window.localStorage.setItem(
        'yifu-navigation-mode',
        options?.navigationMode ?? 'side',
      );
    }
    window.localStorage.setItem(
      'sidebarCollapsed',
      options?.sidebarCollapsed === true ? '1' : '0',
    );

    // Stub Museeks Globals
    vi.stubGlobal('__MUSEEKS_INITIAL_CONFIG', MOCK_CONFIG);
    vi.stubGlobal('__MUSEEKS_INITIAL_QUEUE', []);
    vi.stubGlobal('__MUSEEKS_PLATFORM', import.meta.env.PLATFORM);

    // Stub Tauri Globals
    vi.stubGlobal('__TAURI_INTERNALS__', {
      __TAURI_PATTERN__: { pattern: 'brownfield' },
      plugins: { path: { sep: '/', delimiter: ':' } },
      metadata: {
        currentWindow: { label: 'main' },
        currentWebview: { label: 'main' },
      },
      callbacks: new Map(),
      // mocks
      invoke: vi.fn<Whatever>(),
      convertFileSrc: (path: string) => path,
      ipc: vi.fn<Whatever>(),
      postMessage: vi.fn<Whatever>(),
      runCallback: vi.fn<Whatever>(),
      transformCallback: vi.fn<Whatever>(),
      unregisterCallback: vi.fn<Whatever>(),
    });
    vi.stubGlobal('__TAURI_EVENT_PLUGIN_INTERNALS__', {
      unregisterListener: vi.fn<Whatever>(),
    });
    vi.stubGlobal('__TAURI_OS_PLUGIN_INTERNALS__', {
      // TODO: replace that with Linux values
      arch: 'aarch64',
      eol: '↵',
      exe_extension: '',
      family: 'unix',
      os_type: 'macos',
      platform: 'macos',
      version: '15.5.0',
    });

    // Activate Lingui
    i18n.load('zh-CN', messages);
    i18n.activate('zh-CN');

    // Mock Bridges
    vi.doMock('../lib/bridge-database');
    vi.doMock('../lib/bridge-config');
    vi.doMock('../lib/cover');
    vi.doMock('../lib/bridge-media-controls');
    vi.doMock('../lib/bridge-native-audio');
    vi.doMock('../lib/bridge-desktop-lyrics');
    vi.doMock('../lib/bridge-lyrics');
    vi.doMock('../lib/bridge-tray');

    // Initial Location
    window.location.hash = '#/library';

    // Render the app
    const { app } = await import('../main.tsx');
    await render(app, {
      wrapper: ({ children }) => <div id="wrap">{children}</div>,
    });
  });
}

/** ----------------------------------------------------------------------------
 * Various helpers for triggering common actions on e2e tests
 * -------------------------------------------------------------------------- */

// Get the primary navigation element for the top-level destinations.
export function getMainNavigation() {
  return page.getByRole('navigation', { name: '主导航' });
}

// Get the system navigation element that contains the settings destination.
export function getSystemNavigation() {
  return page.getByRole('navigation', { name: '系统导航' });
}

// Get the track list element
export function getTrackList() {
  return page.getByRole('listbox', { name: '音轨列表' });
}

// Get a track row by its title
export function getTrackByName(name: string | RegExp) {
  return getTrackList().getByRole('option', { name });
}

// Get a track row by its position in the list
export function getTrackAt(index: number) {
  return getTrackList().getByRole('option').nth(index);
}

// Get a sort button from the track list header by column name
export function getSortButton(name: string) {
  return page
    .getByRole('group', { name: '音轨列表排序选项' })
    .getByRole('button', { name });
}

// Trigger a fake scan of the library based on mocks
export async function setupScannedLibrary() {
  await getSystemNavigation()
    .getByRole('link', { name: '设置', exact: true })
    .click();
  await page.getByRole('button', { name: '扫描' }).click();
  await getMainNavigation().getByRole('link', { name: '音乐库' }).click();
  await expect.element(getTrackAt(0)).toBeVisible();
}
