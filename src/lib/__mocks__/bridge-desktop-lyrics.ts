import { vi } from 'vite-plus/test';

import type {
  DesktopLyricsControl,
  DesktopLyricsControlsBounds,
  DesktopLyricsWindowGeometry,
} from '../bridge-desktop-lyrics';
import {
  EMPTY_DESKTOP_LYRICS_PAYLOAD,
  type DesktopLyricsPayload,
} from '../desktop-lyrics';

const DesktopLyricsBridge = {
  open: vi.fn<() => Promise<void>>().mockResolvedValue(),
  syncState: vi
    .fn<(payload: DesktopLyricsPayload) => Promise<void>>()
    .mockResolvedValue(),
  getState: vi
    .fn<() => Promise<DesktopLyricsPayload>>()
    .mockResolvedValue(EMPTY_DESKTOP_LYRICS_PAYLOAD),
  sendControl: vi
    .fn<(action: DesktopLyricsControl) => Promise<void>>()
    .mockResolvedValue(),
  setMousePassthrough: vi
    .fn<
      (
        enabled: boolean,
        controlsBounds: DesktopLyricsControlsBounds | null,
      ) => Promise<void>
    >()
    .mockResolvedValue(),
  getWindowGeometry: vi
    .fn<() => Promise<DesktopLyricsWindowGeometry>>()
    .mockResolvedValue({
      x: 100,
      y: 100,
      width: 900,
      height: 180,
      scaleFactor: 1,
    }),
  updateWindowGeometry: vi
    .fn<(geometry: DesktopLyricsWindowGeometry) => Promise<void>>()
    .mockResolvedValue(),
  setAlwaysOnTop: vi
    .fn<(alwaysOnTop: boolean) => Promise<void>>()
    .mockResolvedValue(),
  setResizable: vi
    .fn<(resizable: boolean) => Promise<void>>()
    .mockResolvedValue(),
  listenForState: vi
    .fn<
      (callback: (payload: DesktopLyricsPayload) => void) => Promise<() => void>
    >()
    .mockResolvedValue(() => {}),
  listenForControls: vi
    .fn<
      (callback: (action: DesktopLyricsControl) => void) => Promise<() => void>
    >()
    .mockResolvedValue(() => {}),
  close: vi.fn<() => Promise<void>>().mockResolvedValue(),
  startDragging: vi.fn<() => Promise<void>>().mockResolvedValue(),
};

export default DesktopLyricsBridge;
