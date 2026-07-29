import { vi } from 'vite-plus/test';

const NativeAudioBridge = {
  load: vi.fn<() => Promise<null>>(),
  play: vi.fn<() => Promise<boolean>>(),
  pause: vi.fn<() => Promise<boolean>>(),
  seek: vi.fn<() => Promise<null>>(),
  getState: vi.fn<() => Promise<null>>(),
  setVolume: vi.fn<() => Promise<boolean>>(),
  setPlaybackRate: vi.fn<() => Promise<boolean>>(),
  stop: vi.fn<() => Promise<void>>(),
};

export default NativeAudioBridge;
