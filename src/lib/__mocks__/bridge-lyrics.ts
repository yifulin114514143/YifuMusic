import { vi } from 'vite-plus/test';

import type { LyricsReadResult } from '../bridge-lyrics';

const LyricsBridge = {
  getSiblingLyrics: vi
    .fn<(trackId: string) => Promise<LyricsReadResult>>()
    .mockResolvedValue({ status: 'unavailable' }),
  selectAndRead: vi
    .fn<() => Promise<LyricsReadResult>>()
    .mockResolvedValue({ status: 'cancelled' }),
};

export default LyricsBridge;
