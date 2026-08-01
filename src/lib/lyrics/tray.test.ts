import { describe, expect, test } from 'vite-plus/test';

import type { DesktopLyricsPayload } from '../desktop-lyrics';
import { createTrayPayload } from '../tray';

function createPayload(
  overrides: Partial<DesktopLyricsPayload> = {},
): DesktopLyricsPayload {
  return {
    trackId: 'track-1',
    title: '测试曲目',
    artists: ['测试歌手'],
    album: '测试专辑',
    currentTimeSeconds: 4,
    isPaused: false,
    lyrics: [
      { timeMs: 0, text: '第一句' },
      { timeMs: 4_000, text: '第二句' },
    ],
    lyricsKind: 'timed',
    ...overrides,
  };
}

describe('托盘状态', () => {
  test('使用当前定时歌词和唯一播放器的曲目信息', () => {
    expect(createTrayPayload(createPayload())).toStrictEqual({
      trackId: 'track-1',
      title: '测试曲目',
      artists: ['测试歌手'],
      isPaused: false,
      currentLyric: '第二句',
    });
  });

  test('没有正在播放的曲目时不会保留旧歌词', () => {
    expect(
      createTrayPayload(
        createPayload({
          trackId: null,
          title: '',
          artists: [],
          lyrics: [{ timeMs: 0, text: '旧歌词' }],
        }),
      ),
    ).toStrictEqual({
      trackId: null,
      title: '',
      artists: [],
      isPaused: false,
      currentLyric: '',
    });
  });
});
