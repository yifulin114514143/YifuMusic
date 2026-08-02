import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

import type { DesktopLyricsPayload } from './desktop-lyrics';

const DESKTOP_LYRICS_STATE_EVENT = 'desktop-lyrics:state';
const DESKTOP_LYRICS_ACTION_EVENT = 'desktop-lyrics:action';

export type DesktopLyricsControl = 'previous' | 'play-pause' | 'next';

export type DesktopLyricsControlsBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
};

export type DesktopLyricsWindowGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
};

const DesktopLyricsBridge = {
  open(): Promise<void> {
    return invoke('plugin:desktop-lyrics|open');
  },

  syncState(payload: DesktopLyricsPayload): Promise<void> {
    return invoke('plugin:desktop-lyrics|sync_state', { payload });
  },

  getState(): Promise<DesktopLyricsPayload> {
    return invoke('plugin:desktop-lyrics|get_state');
  },

  sendControl(action: DesktopLyricsControl): Promise<void> {
    return invoke('plugin:desktop-lyrics|control', { action });
  },

  setMousePassthrough(
    enabled: boolean,
    controlsBounds: DesktopLyricsControlsBounds | null,
  ): Promise<void> {
    return invoke('plugin:desktop-lyrics|set_mouse_passthrough', {
      enabled,
      controlsBounds,
    });
  },

  getWindowGeometry(): Promise<DesktopLyricsWindowGeometry> {
    return invoke('plugin:desktop-lyrics|get_window_geometry');
  },

  updateWindowGeometry(geometry: DesktopLyricsWindowGeometry): Promise<void> {
    return invoke('plugin:desktop-lyrics|update_window_geometry', { geometry });
  },

  setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    return invoke('plugin:desktop-lyrics|set_always_on_top', { alwaysOnTop });
  },

  setResizable(resizable: boolean): Promise<void> {
    return invoke('plugin:desktop-lyrics|set_resizable', { resizable });
  },

  listenForState(
    callback: (payload: DesktopLyricsPayload) => void,
  ): Promise<() => void> {
    return getCurrentWebviewWindow().listen<DesktopLyricsPayload>(
      DESKTOP_LYRICS_STATE_EVENT,
      ({ payload }) => callback(payload),
    );
  },

  listenForControls(
    callback: (action: DesktopLyricsControl) => void,
  ): Promise<() => void> {
    return getCurrentWebviewWindow().listen<DesktopLyricsControl>(
      DESKTOP_LYRICS_ACTION_EVENT,
      ({ payload }) => callback(payload),
    );
  },

  close(): Promise<void> {
    return invoke('plugin:desktop-lyrics|close');
  },

  startDragging(): Promise<void> {
    return invoke('plugin:desktop-lyrics|start_dragging');
  },
};

export default DesktopLyricsBridge;
