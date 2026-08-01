import { describe, expect, test } from 'vite-plus/test';

import { findCurrentLyricLineIndex, parseLocalLyrics } from './local-lyrics';

describe('local lyric parsing', () => {
  test('expands multiple timestamp tags into a sorted playback timeline', () => {
    const lyrics = parseLocalLyrics(
      '[00:04.50]Opening\n[00:02.5][00:06.000]Refrain',
      'sibling-file',
    );

    expect(lyrics).toStrictEqual({
      kind: 'timed',
      lines: [
        { timeMs: 2500, text: 'Refrain' },
        { timeMs: 4500, text: 'Opening' },
        { timeMs: 6000, text: 'Refrain' },
      ],
      source: 'sibling-file',
      message: null,
    });
  });

  test('keeps user-selected plain text readable without a timeline', () => {
    const lyrics = parseLocalLyrics('First line\nSecond line', 'user-file');

    expect(lyrics).toStrictEqual({
      kind: 'plain',
      lines: [
        { timeMs: null, text: 'First line' },
        { timeMs: null, text: 'Second line' },
      ],
      source: 'user-file',
      message: null,
    });
  });

  test('reports malformed time tags instead of presenting them as timed lyrics', () => {
    const lyrics = parseLocalLyrics('[00:75]Broken timestamp', 'user-file');

    expect(lyrics).toStrictEqual({
      kind: 'unavailable',
      lines: [],
      source: null,
      message: 'invalid-timestamp',
    });
  });

  test('uses the real player time to select the current line after seeking', () => {
    const lyrics = parseLocalLyrics(
      '[00:02.000]First\n[00:04.000]Second\n[00:06.000]Third',
      'sibling-file',
    );

    expect(findCurrentLyricLineIndex(lyrics.lines, 0)).toBeNull();
    expect(findCurrentLyricLineIndex(lyrics.lines, 4.5)).toBe(1);
    expect(findCurrentLyricLineIndex(lyrics.lines, 7)).toBe(2);
  });
});
