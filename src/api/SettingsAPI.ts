import { t } from '@lingui/core/macro';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { info } from '@tauri-apps/plugin-log';
import * as semver from 'semver';

import type { Config } from '../generated/typings';
import ConfigBridge from '../lib/bridge-config';
import SettingsBridge from '../lib/bridge-settings';
import { loadTranslation } from '../lib/i18n';
import player from '../lib/player';
import { getTheme } from '../lib/themes';
import toastManager from '../lib/toast-manager';
import { logAndNotifyError } from '../lib/utils';
import LibraryAPI from './LibraryAPI';

export const DEFAULT_MAIN_COLOR = '#FF69B4';

const HEX_COLOR_INPUT_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * Pick the readable black or white foreground for a native color input value.
 * Invalid persisted values leave the theme's built-in contrast token in place.
 */
export function getAccentContrast(
  mainColor: Config['ui_accent_color'],
): '#000000' | '#ffffff' | null {
  const match = mainColor?.match(HEX_COLOR_INPUT_PATTERN);

  if (match == null) {
    return null;
  }

  const [red, green, blue] = match
    .slice(1)
    .map((value) => Number.parseInt(value, 16) / 255);
  const toLinear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);

  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

/**
 * THIS WHOLE MODULE IS DEPRECATED as it has organically grown into something weird
 * and should be merged somehow with BridgeSettings + a way to listen and react
 * to config changes and react to them.
 */

// Manual prevention of a useEffect being called twice (to avoid refreshing the
// library twice on startup in dev mode).
// Also, we useInvalidate, SettingsAPI.init would infinitely loop. It means
// something is fishy and need to be fixed "somewhere".
let did_init = false;

/**
 * Init all settings, then show the app
 */
async function init(then: () => void): Promise<void> {
  if (did_init) return;

  did_init = true;

  // Blocking (the window should not be shown until it's done)
  const [theme, color] = await Promise.all([
    getCurrentWindow()
      .theme()
      .then((maybeTheme) => maybeTheme ?? 'light'),
    ConfigBridge.get('ui_accent_color').then((c) => c ?? DEFAULT_MAIN_COLOR),
  ]);

  applyThemeToUI(theme);
  applyUIMainColorToUI(color);

  // Show the app and apply persisted menu bar visibility
  await SettingsBridge.showWindow();
  info('UI is ready!');

  // Non-blocking, these can be done later
  checkForLibraryRefresh().catch(logAndNotifyError);
  checkForUpdate({ silentFail: true }).catch(logAndNotifyError);

  // Check if we should start a queue (maybe put that somewhere else)
  const initialQueue = window.__MUSEEKS_INITIAL_QUEUE;
  if (initialQueue !== null && initialQueue.length > 0) {
    info(
      `Starting queue from file associations (${initialQueue.length} tracks)`,
    );
    await player.start(initialQueue, initialQueue[0].id, {
      type: 'file_associations',
    });
  }

  then();
}

const setLanguage = async (language: Config['language']): Promise<void> => {
  await loadTranslation(language);
  await ConfigBridge.set('language', language);
};

const setTheme = async (themeID: string): Promise<void> => {
  await ConfigBridge.set('theme', themeID);

  switch (themeID) {
    case '__system': {
      await getCurrentWindow().setTheme(null);
      break;
    }
    case 'light': {
      await getCurrentWindow().setTheme('light');
      break;
    }
    case 'dark': {
      await getCurrentWindow().setTheme('dark');
      break;
    }
  }

  const [theme, mainColor] = await Promise.all([
    getCurrentWindow()
      .theme()
      .then((value) => value ?? 'light'),
    ConfigBridge.get('ui_accent_color').then(
      (value) => value ?? DEFAULT_MAIN_COLOR,
    ),
  ]);

  applyThemeToUI(theme);
  applyUIMainColorToUI(mainColor);
};

/**
 * Apply theme colors to  the BrowserWindow
 */
function applyThemeToUI(themeID: string): void {
  const theme = getTheme(themeID);

  // TODO think about variables validity?
  // TODO: update the window theme dynamically
  const root = document.documentElement;
  Object.entries(theme.variables).forEach(([property, value]) => {
    root.style.setProperty(property, value);
  });
}

async function setTracksDensity(
  density: Config['track_view_density'],
): Promise<void> {
  await ConfigBridge.set('track_view_density', density);
}

const setUIMainColor = async (
  mainColor: Config['ui_accent_color'],
): Promise<void> => {
  await ConfigBridge.set('ui_accent_color', mainColor);
};

const applyUIMainColorToUI = (mainColor: Config['ui_accent_color']) => {
  const root = document.documentElement;

  if (mainColor === null) {
    root.style.removeProperty('--main-color');
    root.style.removeProperty('--accent-contrast');
    return;
  }

  root.style.setProperty('--main-color', mainColor);

  const contrast = getAccentContrast(mainColor);
  if (contrast === null) {
    root.style.removeProperty('--accent-contrast');
    return;
  }

  root.style.setProperty('--accent-contrast', contrast);
};

/**
 * Check if a new release is available
 */
async function checkForUpdate(
  options: { silentFail?: boolean } = {},
): Promise<void> {
  const shouldCheck = await ConfigBridge.get('auto_update_checker');

  if (!shouldCheck) {
    return;
  }

  const currentVersion = await getVersion();

  try {
    const response = await fetch(
      'https://api.github.com/repos/yifulin114514143/YifuMusic/releases',
    );

    if (!response.ok) {
      if (options.silentFail) {
        return;
      }

      throw new Error('Impossible to retrieve releases information.');
    }

    const releases: any = await response.json();

    // TODO Github API types?
    const newRelease = releases.find(
      (release: any) =>
        semver.valid(release.tag_name) !== null &&
        semver.gt(release.tag_name, currentVersion),
    );

    let message: string | undefined;
    if (newRelease) {
      message = t`YifuMusic ${newRelease.tag_name} is available.`;
    } else if (!options.silentFail) {
      message = t`YifuMusic ${currentVersion} is the latest version available.`;
    }

    if (message) {
      toastManager.add({ title: message, type: 'success' });
    }
  } catch (e) {
    logAndNotifyError(
      e,
      'An error occurred while checking updates.',
      true,
      options.silentFail,
    );
  }
}

/**
 * Toggle library refresh on startup
 */
async function toggleLibraryAutorefresh(value: boolean): Promise<void> {
  await ConfigBridge.set('library_autorefresh', value);
}

async function checkForLibraryRefresh(): Promise<void> {
  const autorefreshEnabled = ConfigBridge.getInitial('library_autorefresh');

  if (autorefreshEnabled) {
    void LibraryAPI.scan();
  }
}

/**
 * Toggle update check on startup
 */
async function toggleAutoUpdateChecker(value: boolean): Promise<void> {
  await ConfigBridge.set('auto_update_checker', value);
}

/**
 * Toggle native notifications display
 */
async function toggleDisplayNotifications(value: boolean): Promise<void> {
  await ConfigBridge.set('notifications', value);
}

/**
 * Toggle follow track on track change
 */
async function toggleFollowPlayingTrack(value: boolean): Promise<void> {
  await ConfigBridge.set('audio_follow_playing_track', value);
}

// Should we use something else to harmonize between zustand and non-store APIs?
const SettingsAPI = {
  init,
  setLanguage,
  setTheme,
  applyThemeToUI,
  setUIMainColor,
  applyUIMainColorToUI,
  setTracksDensity,
  checkForUpdate,
  toggleLibraryAutorefresh,
  toggleAutoUpdateChecker,
  toggleDisplayNotifications,
  toggleFollowPlayingTrack,
};

export default SettingsAPI;
