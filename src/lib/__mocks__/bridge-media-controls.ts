import { vi } from 'vite-plus/test';

const unavailable = {
  supported: false,
  applied: false,
  reason: 'Native media controls are unavailable in browser tests',
};

const MediaControlsBridge = {
  setMetadata: vi
    .fn<() => Promise<typeof unavailable>>()
    .mockResolvedValue(unavailable),
  setPlayback: vi
    .fn<() => Promise<typeof unavailable>>()
    .mockResolvedValue(unavailable),
  clear: vi
    .fn<() => Promise<typeof unavailable>>()
    .mockResolvedValue(unavailable),
  listenToCommands: vi
    .fn<() => Promise<() => void>>()
    .mockResolvedValue(() => {}),
};

export default MediaControlsBridge;
