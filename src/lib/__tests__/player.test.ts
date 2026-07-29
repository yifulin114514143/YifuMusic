import { beforeAll, describe, expect, test, vi } from 'vite-plus/test';

import type { Track } from '../../generated/typings';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => path,
}));
vi.mock('../bridge-config', () => ({
  default: {
    getInitial: (key: string) =>
      ({
        audio_volume: 1,
        audio_playback_rate: 1,
        audio_muted: false,
      })[key],
    set: vi.fn<() => Promise<void>>(),
    multiSet: vi.fn<() => Promise<void>>(),
  },
}));
vi.mock('../cover', () => ({ getCover: vi.fn<() => Promise<null>>() }));
vi.mock('../utils', () => ({ logAndNotifyError: vi.fn<() => void>() }));

class FakeAudio extends EventTarget {
  src = '';
  currentTime = 0;
  duration = Number.NaN;
  defaultPlaybackRate = 1;
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  error: MediaError | null = null;
  listenerCounts = new Map<string, number>();

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ) {
    this.listenerCounts.set(type, (this.listenerCounts.get(type) ?? 0) + 1);
    super.addEventListener(type, callback, options);
  }

  async play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

const tracks: Track[] = ['a', 'b', 'c'].map((id, index) => ({
  id,
  path: `/${id}.mp3`,
  title: id,
  album: 'album',
  album_artist: 'artist',
  artists: ['artist'],
  genres: [],
  year: null,
  duration: 120 + index,
  track_no: index + 1,
  track_of: 3,
  disk_no: 1,
  disk_of: 1,
  is_compilation: false,
}));

let Player: typeof import('../player').Player;

beforeAll(async () => {
  vi.stubGlobal('window', {
    __MUSEEKS_INITIAL_CONFIG: {
      audio_playback_mode: 'sequential',
      audio_volume: 1,
      audio_playback_rate: 1,
      audio_muted: false,
    },
    __MUSEEKS_STREAM_SERVER_URL: null,
  });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('Audio', FakeAudio);
  ({ Player } = await import('../player'));
});

describe('player media events', () => {
  test('registers each core media event once', () => {
    const audio = new FakeAudio();
    new Player({ audio: audio as unknown as HTMLAudioElement });

    for (const event of [
      'loadstart',
      'loadedmetadata',
      'durationchange',
      'seeking',
      'seeked',
      'timeupdate',
      'ended',
      'error',
    ]) {
      expect(audio.listenerCounts.get(event)).toBe(1);
    }
  });

  test('uses real duration and resets time and duration on track change', async () => {
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start(tracks, 'a', { type: 'library' });

    audio.duration = 150;
    audio.currentTime = 45;
    audio.dispatchEvent(new Event('loadedmetadata'));
    audio.dispatchEvent(new Event('timeupdate'));
    expect(player.getState()).toMatchObject({
      currentTime: 45,
      mediaDuration: 150,
      isMetadataLoaded: true,
      duration: 150,
    });

    audio.duration = 147;
    audio.dispatchEvent(new Event('durationchange'));
    expect(player.getState()).toMatchObject({
      mediaDuration: 147,
      duration: 147,
    });

    await player.startFromQueue(1);
    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      isMetadataLoaded: false,
      isSeeking: false,
      duration: 121,
    });
  });

  test('rejects invalid seek values, clamps real duration, and updates immediately', async () => {
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start(tracks, 'a', { type: 'library' });
    audio.duration = 100;
    audio.dispatchEvent(new Event('loadedmetadata'));

    player.setCurrentTime(Number.NaN);
    player.setCurrentTime(-1);
    expect(audio.currentTime).toBe(0);
    player.setCurrentTime(130);
    expect(audio.currentTime).toBe(100);
    expect(player.getState().currentTime).toBe(100);
  });

  test('clears stale progress and duration when media loading fails', async () => {
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start(tracks, 'a', { type: 'library' });
    audio.duration = 150;
    audio.currentTime = 45;
    audio.dispatchEvent(new Event('loadedmetadata'));
    audio.dispatchEvent(new Event('timeupdate'));
    audio.error = { message: 'decode failed' } as MediaError;
    audio.dispatchEvent(new Event('error'));

    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      isMetadataLoaded: false,
      isSeeking: false,
      duration: null,
      mediaError: 'decode failed',
    });
  });
});
