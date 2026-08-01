import { describe, expect, test } from 'vite-plus/test';

import {
  createDesktopLyricsPayload,
  getDesktopLyricsDisplay,
} from '../desktop-lyrics';

describe('desktop lyrics presentation', () => {
  test('uses the current timed line and interpolates its highlight progress', () => {
    const display = getDesktopLyricsDisplay({
      trackId: 'track-1',
      title: 'Example',
      artists: ['Artist'],
      album: 'Album',
      currentTimeSeconds: 3,
      isPaused: false,
      lyricsKind: 'timed',
      lyrics: [
        { timeMs: 1_000, text: 'First line' },
        { timeMs: 5_000, text: 'Second line' },
      ],
    });

    expect(display).toStrictEqual({
      currentLine: { timeMs: 1_000, text: 'First line' },
      nextLine: { timeMs: 5_000, text: 'Second line' },
      highlightProgress: 0.5,
    });
  });

  test('keeps plain lyrics readable without manufacturing a timed highlight', () => {
    const display = getDesktopLyricsDisplay({
      trackId: 'track-1',
      title: 'Example',
      artists: [],
      album: '',
      currentTimeSeconds: 12,
      isPaused: false,
      lyricsKind: 'plain',
      lyrics: [
        { timeMs: null, text: 'First line' },
        { timeMs: null, text: 'Second line' },
      ],
    });

    expect(display).toStrictEqual({
      currentLine: { timeMs: null, text: 'First line' },
      nextLine: { timeMs: null, text: 'Second line' },
      highlightProgress: 0,
    });
  });

  test('does not expose a stale track identity when no track is playing', () => {
    const payload = createDesktopLyricsPayload({
      track: null,
      currentTimeSeconds: Number.NaN,
      isPaused: true,
      lyrics: { lyrics: [], lyricsKind: 'unavailable' },
    });

    expect(payload).toMatchObject({
      trackId: null,
      title: '',
      currentTimeSeconds: 0,
      lyrics: [],
      lyricsKind: 'unavailable',
    });
  });
});
