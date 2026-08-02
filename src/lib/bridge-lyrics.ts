import { invoke } from '@tauri-apps/api/core';

export type LyricsReadResult =
  | {
      status: 'available';
      source: 'sibling-file' | 'user-file';
      text: string;
    }
  | { status: 'unavailable' }
  | { status: 'failed' }
  | { status: 'cancelled' };

const LyricsBridge = {
  getSiblingLyrics(trackId: string): Promise<LyricsReadResult> {
    return invoke('plugin:lyrics|get_sibling_lyrics', { trackId });
  },

  selectAndRead(): Promise<LyricsReadResult> {
    return invoke('plugin:lyrics|select_and_read');
  },
};

export default LyricsBridge;
