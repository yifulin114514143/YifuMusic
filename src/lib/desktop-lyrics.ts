import type { Track } from '../generated/typings';
import {
  findCurrentLyricLineIndex,
  type LyricLine,
} from './lyrics/local-lyrics';

export type DesktopLyricsKind = 'timed' | 'plain' | 'unavailable';

export type DesktopLyricsPayload = {
  trackId: string | null;
  title: string;
  artists: Array<string>;
  album: string;
  currentTimeSeconds: number;
  isPaused: boolean;
  lyrics: Array<LyricLine>;
  lyricsKind: DesktopLyricsKind;
};

export type DesktopLyricsDisplay = {
  currentLine: LyricLine | null;
  nextLine: LyricLine | null;
  highlightProgress: number;
};

export const EMPTY_DESKTOP_LYRICS_PAYLOAD: DesktopLyricsPayload = {
  trackId: null,
  title: '',
  artists: [],
  album: '',
  currentTimeSeconds: 0,
  isPaused: true,
  lyrics: [],
  lyricsKind: 'unavailable',
};

export function createDesktopLyricsPayload({
  track,
  currentTimeSeconds,
  isPaused,
  lyrics,
}: {
  track: Track | null;
  currentTimeSeconds: number;
  isPaused: boolean;
  lyrics: Pick<DesktopLyricsPayload, 'lyrics' | 'lyricsKind'>;
}): DesktopLyricsPayload {
  return {
    trackId: track?.id ?? null,
    title: track?.title ?? '',
    artists: track?.artists ?? [],
    album: track?.album ?? '',
    currentTimeSeconds: Number.isFinite(currentTimeSeconds)
      ? Math.max(0, currentTimeSeconds)
      : 0,
    isPaused,
    ...lyrics,
  };
}

export function getDesktopLyricsDisplay(
  payload: DesktopLyricsPayload,
): DesktopLyricsDisplay {
  if (payload.lyrics.length === 0) {
    return {
      currentLine: null,
      nextLine: null,
      highlightProgress: 0,
    };
  }

  if (payload.lyricsKind !== 'timed') {
    return {
      currentLine: payload.lyrics[0] ?? null,
      nextLine: payload.lyrics[1] ?? null,
      highlightProgress: 0,
    };
  }

  const currentIndex = findCurrentLyricLineIndex(
    payload.lyrics,
    payload.currentTimeSeconds,
  );
  if (currentIndex === null) {
    return {
      currentLine: payload.lyrics[0] ?? null,
      nextLine: payload.lyrics[1] ?? null,
      highlightProgress: 0,
    };
  }

  const currentLine = payload.lyrics[currentIndex] ?? null;
  const nextLine = payload.lyrics[currentIndex + 1] ?? null;
  const currentLineStart = currentLine?.timeMs;
  const nextLineStart = nextLine?.timeMs;
  const currentTimeMs = payload.currentTimeSeconds * 1_000;

  const highlightProgress =
    currentLineStart === null ||
    currentLineStart === undefined ||
    nextLineStart === null ||
    nextLineStart === undefined ||
    nextLineStart <= currentLineStart
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            (currentTimeMs - currentLineStart) /
              (nextLineStart - currentLineStart),
          ),
        );

  return {
    currentLine,
    nextLine,
    highlightProgress,
  };
}
