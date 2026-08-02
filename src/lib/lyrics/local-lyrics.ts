export type LyricLine = {
  timeMs: number | null;
  text: string;
};

export type LyricsSource = 'sibling-file' | 'user-file';

export type LocalLyrics = {
  kind: 'timed' | 'plain' | 'unavailable';
  lines: Array<LyricLine>;
  source: LyricsSource | null;
  message: 'empty' | 'invalid-timestamp' | null;
};

const TIMESTAMP_TAG = /\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const TIME_LIKE_TAG = /^\[\d+:[^\]]*\]/;

function timestampToMilliseconds(match: RegExpExecArray): number | null {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3];

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }

  const fractionMilliseconds =
    fraction === undefined ? 0 : Number(fraction) * 10 ** (3 - fraction.length);

  return minutes * 60_000 + seconds * 1_000 + fractionMilliseconds;
}

function sortLyrics(lines: Array<LyricLine>): Array<LyricLine> {
  return lines.toSorted((left, right) => {
    if (left.timeMs === null) return 1;
    if (right.timeMs === null) return -1;
    return left.timeMs - right.timeMs;
  });
}

export function parseLocalLyrics(
  text: string,
  source: LyricsSource,
): LocalLyrics {
  const lines: Array<LyricLine> = [];
  let hasTimestamp = false;

  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    TIMESTAMP_TAG.lastIndex = 0;
    const timestamps: Array<number> = [];
    let contentStart = 0;
    let match: RegExpExecArray | null;

    while ((match = TIMESTAMP_TAG.exec(line)) !== null) {
      if (match.index !== contentStart) break;

      const timeMs = timestampToMilliseconds(match);
      if (timeMs === null) {
        return {
          kind: 'unavailable',
          lines: [],
          source: null,
          message: 'invalid-timestamp',
        };
      }

      timestamps.push(timeMs);
      contentStart = TIMESTAMP_TAG.lastIndex;
    }

    if (timestamps.length === 0 && TIME_LIKE_TAG.test(line)) {
      return {
        kind: 'unavailable',
        lines: [],
        source: null,
        message: 'invalid-timestamp',
      };
    }

    const lyricText = line.slice(contentStart).trim();
    if (timestamps.length > 0) {
      hasTimestamp = true;
      for (const timeMs of timestamps) {
        lines.push({ timeMs, text: lyricText });
      }
    } else if (lyricText !== '') {
      lines.push({ timeMs: null, text: lyricText });
    }
  }

  if (lines.length === 0) {
    return {
      kind: 'unavailable',
      lines: [],
      source: null,
      message: 'empty',
    };
  }

  return {
    kind: hasTimestamp ? 'timed' : 'plain',
    lines: hasTimestamp ? sortLyrics(lines) : lines,
    source,
    message: null,
  };
}

export function findCurrentLyricLineIndex(
  lines: Array<LyricLine>,
  currentTimeSeconds: number,
): number | null {
  if (!Number.isFinite(currentTimeSeconds)) return null;

  const currentTimeMs = currentTimeSeconds * 1_000;
  let currentIndex: number | null = null;
  let latestTime = -Infinity;

  for (const [index, line] of lines.entries()) {
    if (
      line.timeMs !== null &&
      line.timeMs <= currentTimeMs &&
      line.timeMs >= latestTime
    ) {
      currentIndex = index;
      latestTime = line.timeMs;
    }
  }

  return currentIndex;
}
