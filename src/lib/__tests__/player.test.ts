import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test';

import type { Track } from '../../generated/typings';
import type {
  MediaControlsMetadata,
  MediaControlsPlayback,
  MediaControlsUpdateResult,
} from '../bridge-media-controls';
import type { NativeAudioState } from '../bridge-native-audio';
import type { PlayerMediaError, PlayerState } from '../player';

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
vi.mock('../bridge-media-controls', () => ({
  default: {
    setMetadata:
      vi.fn<
        (metadata: MediaControlsMetadata) => Promise<MediaControlsUpdateResult>
      >(),
    setPlayback:
      vi.fn<
        (playback: MediaControlsPlayback) => Promise<MediaControlsUpdateResult>
      >(),
    clear: vi.fn<(sessionID: number) => Promise<MediaControlsUpdateResult>>(),
  },
}));
vi.mock('../bridge-native-audio', () => ({
  default: {
    load: vi.fn<
      (path: string, requestID: number) => Promise<NativeAudioState | null>
    >(),
    play: vi.fn<(requestID: number) => Promise<boolean>>(),
    pause: vi.fn<(requestID: number) => Promise<boolean>>(),
    seek: vi.fn<
      (position: number, requestID: number) => Promise<NativeAudioState | null>
    >(),
    getState: vi.fn<(requestID: number) => Promise<NativeAudioState | null>>(),
    setVolume: vi.fn<(volume: number, requestID: number) => Promise<boolean>>(),
    setPlaybackRate:
      vi.fn<(rate: number, requestID: number) => Promise<boolean>>(),
    stop: vi.fn<() => Promise<void>>(),
  },
}));
vi.mock('../utils', () => ({ logAndNotifyError: vi.fn<() => void>() }));

class FakeAudio extends EventTarget {
  private source = '';
  currentTime = 0;
  duration = Number.NaN;
  defaultPlaybackRate = 1;
  playbackRate = 1;
  volume = 1;
  muted = false;
  paused = true;
  error: MediaError | null = null;
  loadCalls = 0;
  listenerCounts = new Map<string, number>();

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.currentTime = 0;
    this.duration = Number.NaN;
  }

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

  load() {
    this.loadCalls += 1;
    this.dispatchEvent(new Event('loadstart'));
  }

  completeSeek(actualTime: number) {
    this.currentTime = actualTime;
    this.dispatchEvent(new Event('seeked'));
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

function nativeState(
  overrides: Partial<NativeAudioState> = {},
): NativeAudioState {
  return {
    position: 0,
    duration: 261.249563,
    isPaused: true,
    terminalState: { kind: 'paused' },
    ...overrides,
  };
}

function waitForNativeOperation() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function getMediaControlsMocks() {
  const bridge = (await import('../bridge-media-controls')).default;
  return {
    setMetadata: vi.mocked(bridge.setMetadata),
    setPlayback: vi.mocked(bridge.setPlayback),
    clear: vi.mocked(bridge.clear),
  };
}

class FakeMediaMetadata {
  constructor(readonly init: MediaMetadataInit) {}
}

function installWebKitMediaSession() {
  const handlers = new Map<
    MediaSessionAction,
    MediaSessionActionHandler | null
  >();
  const mediaSession = {
    metadata: null as FakeMediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    setActionHandler: vi.fn<
      (
        action: MediaSessionAction,
        handler: MediaSessionActionHandler | null,
      ) => void
    >(
      (
        action: MediaSessionAction,
        handler: MediaSessionActionHandler | null,
      ) => {
        handlers.set(action, handler);
      },
    ),
  };

  vi.stubGlobal('navigator', { mediaSession });
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata);
  return { handlers, mediaSession };
}

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
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubGlobal('navigator', {});
    window.__MUSEEKS_STREAM_SERVER_URL = undefined;
    const { setMetadata, setPlayback, clear } = await getMediaControlsMocks();
    setMetadata.mockResolvedValue({
      supported: true,
      applied: true,
      reason: null,
    });
    setPlayback.mockResolvedValue({
      supported: true,
      applied: true,
      reason: null,
    });
    clear.mockResolvedValue({
      supported: true,
      applied: true,
      reason: null,
    });
  });

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

  test('recovers real duration from timeupdate without metadata events', async () => {
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start(tracks, 'a', { type: 'library' });

    expect(player.getState()).toMatchObject({
      mediaDuration: null,
      isMetadataLoaded: false,
      duration: 120,
    });

    const stateChange = vi.fn<(state: PlayerState) => void>();
    const durationChange = vi.fn<(duration: number | null) => void>();
    player.on('stateChange', stateChange);
    player.on('durationchange', durationChange);

    const duration = 269.815873015873;
    audio.duration = duration;
    audio.currentTime = 260.013;
    audio.dispatchEvent(new Event('timeupdate'));

    expect(player.getState()).toMatchObject({
      currentTime: 260.013,
      mediaDuration: duration,
      isMetadataLoaded: true,
      duration,
    });
    expect(durationChange).toHaveBeenCalledTimes(1);
    expect(durationChange).toHaveBeenLastCalledWith(duration);
    expect(stateChange).toHaveBeenCalledTimes(1);

    audio.currentTime = 266.013;
    audio.dispatchEvent(new Event('timeupdate'));

    expect(player.getState().mediaDuration).toBe(duration);
    expect(durationChange).toHaveBeenCalledTimes(1);
    expect(stateChange).toHaveBeenCalledTimes(2);

    audio.dispatchEvent(new Event('timeupdate'));
    expect(durationChange).toHaveBeenCalledTimes(1);
    expect(stateChange).toHaveBeenCalledTimes(2);

    audio.duration = 270;
    audio.dispatchEvent(new Event('seeked'));
    expect(player.getState().mediaDuration).toBe(270);

    audio.duration = 271;
    audio.paused = false;
    audio.dispatchEvent(new Event('play'));
    expect(player.getState().mediaDuration).toBe(271);

    audio.duration = 272;
    audio.paused = true;
    audio.dispatchEvent(new Event('pause'));
    expect(player.getState().mediaDuration).toBe(272);

    audio.duration = 273;
    player.setCurrentTime(260);
    expect(player.getState()).toMatchObject({
      currentTime: 260,
      mediaDuration: 273,
      duration: 273,
    });

    audio.duration = Number.NaN;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(player.getState().mediaDuration).toBe(273);
  });

  test('recovers real duration from play and pause without metadata events', async () => {
    const duration = 269.815873015873;

    const playAudio = new FakeAudio();
    const playPlayer = new Player({
      audio: playAudio as unknown as HTMLAudioElement,
    });
    await playPlayer.start(tracks, 'a', { type: 'library' });
    playAudio.duration = duration;
    await playPlayer.play();
    expect(playPlayer.getState()).toMatchObject({
      mediaDuration: duration,
      duration,
      isMetadataLoaded: true,
    });

    const pauseAudio = new FakeAudio();
    const pausePlayer = new Player({
      audio: pauseAudio as unknown as HTMLAudioElement,
    });
    await pausePlayer.start(tracks, 'a', { type: 'library' });
    pauseAudio.duration = duration;
    pausePlayer.pause();
    expect(pausePlayer.getState()).toMatchObject({
      mediaDuration: duration,
      duration,
      isMetadataLoaded: true,
    });

    const seekAudio = new FakeAudio();
    const seekPlayer = new Player({
      audio: seekAudio as unknown as HTMLAudioElement,
    });
    await seekPlayer.start(tracks, 'a', { type: 'library' });
    seekAudio.duration = duration;
    seekPlayer.setCurrentTime(264);
    expect(seekAudio.currentTime).toBe(264);
    expect(seekPlayer.getState()).toMatchObject({
      currentTime: 264,
      mediaDuration: duration,
      duration,
      isMetadataLoaded: true,
    });
  });

  test('uses the actual seeked position after writing a near-end seek target', async () => {
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start(tracks, 'a', { type: 'library' });

    const duration = 269.815873015873;
    audio.duration = duration;
    audio.dispatchEvent(new Event('loadedmetadata'));

    player.setCurrentTime(264);
    expect(audio.currentTime).toBe(264);
    expect(player.getState()).toMatchObject({
      currentTime: 264,
      duration,
      mediaDuration: duration,
    });

    audio.dispatchEvent(new Event('seeking'));
    audio.completeSeek(264.014);

    expect(player.getState()).toMatchObject({
      currentTime: 264.014,
      isSeeking: false,
    });
  });

  test('synchronizes MP3 metadata, playback and position through one native media session', async () => {
    const { setMetadata, setPlayback, clear } = await getMediaControlsMocks();
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });

    await player.start(tracks, 'a', { type: 'library' });

    expect(setMetadata).toHaveBeenCalledWith({
      sessionId: 1,
      title: 'a',
      artist: 'artist',
      album: 'album',
      duration: 120,
      trackPath: '/a.mp3',
    });
    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 1,
      state: 'playing',
      position: 0,
    });

    audio.duration = 269.815873015873;
    audio.currentTime = 260.013;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(setMetadata).toHaveBeenLastCalledWith({
      sessionId: 1,
      title: 'a',
      artist: 'artist',
      album: 'album',
      duration: 269.815873015873,
      trackPath: '/a.mp3',
    });
    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 1,
      state: 'playing',
      position: 260.013,
    });

    player.pause();
    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 1,
      state: 'paused',
      position: 260.013,
    });
    player.stop();
    expect(clear).toHaveBeenLastCalledWith(1);
  });

  test('routes every non-FLAC format through the WebKit media session', async () => {
    const { handlers, mediaSession } = installWebKitMediaSession();
    const { setMetadata, setPlayback } = await getMediaControlsMocks();
    const webKitTracks = [
      'mp3',
      'aac',
      'm4a',
      '3gp',
      'wav',
      'ogg',
      'opus',
      'weba',
    ].map((extension, index) => ({
      ...tracks[index % tracks.length],
      id: `webkit-${extension}`,
      path: `/webkit.${extension}`,
    }));
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });

    await player.start(webKitTracks, webKitTracks[0].id, {
      type: 'library',
    });
    await waitForNativeOperation();

    expect(mediaSession.playbackState).toBe('playing');
    expect(mediaSession.metadata?.init).toMatchObject({
      title: 'a',
      artist: 'artist',
      album: 'album',
    });
    expect(handlers.get('play')).toBeTypeOf('function');
    expect(handlers.get('pause')).toBeTypeOf('function');
    expect(handlers.get('previoustrack')).toBeTypeOf('function');
    expect(handlers.get('nexttrack')).toBeTypeOf('function');

    handlers.get('nexttrack')?.({} as MediaSessionActionDetails);
    await waitForNativeOperation();

    for (const track of webKitTracks.slice(1)) {
      expect(player.getTrack()).toStrictEqual(track);
      expect(audio.src).toBe(track.path);
      expect(handlers.get('nexttrack')).toBeTypeOf('function');
      expect(mediaSession.playbackState).toBe('playing');
      if (track !== webKitTracks.at(-1)) {
        handlers.get('nexttrack')?.({} as MediaSessionActionDetails);
        await waitForNativeOperation();
      }
    }

    window.__MUSEEKS_STREAM_SERVER_URL = 'http://127.0.0.1:7777';
    await player.start([webKitTracks[0]], webKitTracks[0].id, {
      type: 'library',
    });
    await waitForNativeOperation();

    expect(audio.src).toBe('http://127.0.0.1:7777/stream?track_id=webkit-mp3');
    expect(handlers.get('nexttrack')).toBeTypeOf('function');
    expect(mediaSession.playbackState).toBe('playing');

    for (const track of webKitTracks) {
      await player.start([track], track.id, { type: 'library' });
      await waitForNativeOperation();
      expect(player.getTrack()).toStrictEqual(track);
      expect(audio.src).toBe(
        `http://127.0.0.1:7777/stream?track_id=${track.id}`,
      );
      expect(handlers.get('nexttrack')).toBeTypeOf('function');
      expect(mediaSession.playbackState).toBe('playing');
    }

    expect(setMetadata).not.toHaveBeenCalled();
    expect(setPlayback).not.toHaveBeenCalled();
    player.stop();
    expect(mediaSession.playbackState).toBe('none');
    window.__MUSEEKS_STREAM_SERVER_URL = undefined;
    vi.stubGlobal('navigator', {});
  });

  test('synchronizes FLAC actual duration and position through the same native media session', async () => {
    const { setMetadata, setPlayback } = await getMediaControlsMocks();
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'media-session-flac',
      path: '/media-session.flac',
    };
    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockResolvedValue(nativeState({ duration: 269.815873 }));
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.getState.mockResolvedValue(
      nativeState({
        position: 260.013,
        duration: 269.815873,
        isPaused: false,
        terminalState: { kind: 'playing' },
      }),
    );
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start([flacTrack], flacTrack.id, { type: 'library' });
    await waitForNativeOperation();

    expect(setMetadata).toHaveBeenLastCalledWith({
      sessionId: 1,
      title: 'a',
      artist: 'artist',
      album: 'album',
      duration: 269.815873,
      trackPath: '/media-session.flac',
    });
    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 1,
      state: 'playing',
      position: 260.013,
    });
  });

  test('does not resume an obsolete session after a rapid track change', async () => {
    const { setMetadata, setPlayback } = await getMediaControlsMocks();
    let resolveFirstMetadata: () => void;
    const firstMetadata = new Promise<void>((resolve) => {
      resolveFirstMetadata = resolve;
    });
    setMetadata
      .mockImplementationOnce(() => firstMetadata as never)
      .mockResolvedValue({ supported: true, applied: true, reason: null });

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const firstStart = player.start([tracks[0]], tracks[0].id, {
      type: 'library',
    });
    await waitForNativeOperation();
    const secondStart = player.start([tracks[1]], tracks[1].id, {
      type: 'library',
    });
    await waitForNativeOperation();
    resolveFirstMetadata!();
    await firstStart;
    await secondStart;

    expect(player.getTrack()).toStrictEqual(tracks[1]);
    expect(setMetadata.mock.calls).toMatchObject([
      [
        {
          sessionId: 1,
          title: 'a',
        },
      ],
      [
        {
          sessionId: 2,
          title: 'b',
        },
      ],
    ]);
    expect(
      setPlayback.mock.calls.filter(([playback]) => playback.sessionId === 1),
    ).toHaveLength(0);
    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 2,
      state: 'playing',
      position: 0,
    });
  });

  test('uses the native backend and its actual seek result for FLAC', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const duration = 261.249563;

    nativeAudio.load.mockResolvedValue({
      position: 0,
      duration,
      isPaused: true,
      terminalState: { kind: 'paused' },
    });
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.pause.mockResolvedValue(true);
    nativeAudio.getState.mockResolvedValue({
      position: 0,
      duration,
      isPaused: true,
      terminalState: { kind: 'paused' },
    });
    nativeAudio.seek.mockResolvedValue({
      position: 258.014,
      duration,
      isPaused: false,
      terminalState: { kind: 'playing' },
    });
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);
    nativeAudio.stop.mockResolvedValue();

    const flacTrack: Track = {
      ...tracks[0],
      id: 'flac',
      path: '/flac.flac',
    };
    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start([flacTrack], flacTrack.id, { type: 'library' });

    expect(nativeAudio.load.mock.calls).toStrictEqual([['/flac.flac', 1]]);
    expect(audio.src).toBe('');
    expect(player.getState()).toMatchObject({
      currentTime: 0,
      duration,
      mediaDuration: duration,
      isMetadataLoaded: true,
      isPaused: false,
    });

    player.setCurrentTime(258);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(nativeAudio.seek.mock.calls).toStrictEqual([[258, 1]]);
    expect(player.getState().currentTime).toBe(258.014);

    player.pause();
    expect(nativeAudio.pause.mock.calls).toStrictEqual([[1]]);
    player.stop();
    expect(nativeAudio.stop.mock.calls).toStrictEqual([[1], [2]]);
  });

  test('reloads the WebKit source when moving from FLAC to MP3', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'flac-before-mp3',
      path: '/flac-before-mp3.flac',
    };
    const mp3Track: Track = {
      ...tracks[1],
      id: 'mp3-after-flac',
      path: '/mp3-after-flac.mp3',
    };
    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockResolvedValue(nativeState());
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.getState.mockResolvedValue(null);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start([flacTrack, mp3Track], flacTrack.id, {
      type: 'library',
    });
    await player.next();

    expect(audio.src).toBe('/mp3-after-flac.mp3');
    expect(audio.loadCalls).toBe(1);
    player.stop();
  });

  test('does not let a stalled media-controls update block FLAC to MP3 playback', async () => {
    const { setMetadata, setPlayback } = await getMediaControlsMocks();
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'flac-before-stalled-metadata',
      path: '/flac-before-stalled-metadata.flac',
    };
    const mp3Track: Track = {
      ...tracks[1],
      id: 'mp3-after-stalled-metadata',
      path: '/mp3-after-stalled-metadata.mp3',
    };
    let resolveMp3Metadata: (result: MediaControlsUpdateResult) => void;
    const pendingMp3Metadata = new Promise<MediaControlsUpdateResult>(
      (resolve) => {
        resolveMp3Metadata = resolve;
      },
    );

    setMetadata
      .mockResolvedValueOnce({ supported: true, applied: true, reason: null })
      .mockResolvedValueOnce({ supported: true, applied: true, reason: null })
      .mockImplementationOnce(() => pendingMp3Metadata);
    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockResolvedValue(nativeState());
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.getState.mockResolvedValue(null);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start([flacTrack, mp3Track], flacTrack.id, {
      type: 'library',
    });

    const transition = player.next();
    await waitForNativeOperation();

    expect(audio.src).toBe('/mp3-after-stalled-metadata.mp3');
    expect(audio.paused).toBe(false);

    resolveMp3Metadata!({ supported: true, applied: true, reason: null });
    await transition;
    await waitForNativeOperation();

    expect(setPlayback).toHaveBeenLastCalledWith({
      sessionId: 2,
      state: 'playing',
      position: 0,
    });
    player.stop();
  });

  test('ignores the stale WebKit error while native FLAC loading takes ownership', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'flac-loading',
      path: '/flac-loading.flac',
    };
    const nativeState: NativeAudioState = {
      position: 0,
      duration: 261.249563,
      isPaused: true,
      terminalState: { kind: 'paused' },
    };
    let resolveLoad: (value: NativeAudioState) => void;
    const pendingLoad = new Promise<NativeAudioState>((resolve) => {
      resolveLoad = resolve;
    });

    nativeAudio.load.mockImplementationOnce(() => pendingLoad as never);
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.getState.mockResolvedValue(nativeState);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);
    nativeAudio.stop.mockResolvedValue();

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    player.on('error', () => player.stop());

    const start = player.start([flacTrack], flacTrack.id, {
      type: 'library',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    audio.error = { message: 'stale WebKit source error' } as MediaError;
    audio.dispatchEvent(new Event('error'));

    expect(player.getQueue()).toStrictEqual([flacTrack]);

    resolveLoad!(nativeState);
    await start;
  });

  test('clears player state and reports a native error when FLAC loading fails', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'flac-load-failure',
      path: '/flac-load-failure.flac',
    };
    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockRejectedValue(
      new Error('Native audio path is not authorized'),
    );

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const ended = vi.fn<() => void>();
    const error = vi.fn<(error: PlayerMediaError) => void>();
    player.on('ended', ended);
    player.on('error', error);

    await player.start([flacTrack], flacTrack.id, { type: 'library' });

    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      isMetadataLoaded: false,
      isSeeking: false,
      duration: null,
      isPaused: true,
      mediaError:
        'Unable to play this FLAC file: Native audio path is not authorized',
    });
    expect(
      (player as unknown as { nativeAudioTrackID: string | null })
        .nativeAudioTrackID,
    ).toBeNull();
    expect(nativeAudio.getState.mock.calls).toHaveLength(0);
    expect(ended).not.toHaveBeenCalled();
    expect(error).toHaveBeenLastCalledWith({
      kind: 'native',
      message:
        'Unable to play this FLAC file: Native audio path is not authorized',
    });
    expect(nativeAudio.stop.mock.calls).toStrictEqual([[1], [2]]);
  });

  test('ignores delayed FLAC loading and polling after switching to another FLAC then MP3', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const firstFlac: Track = {
      ...tracks[0],
      id: 'first-flac',
      path: '/first.flac',
    };
    const secondFlac: Track = {
      ...tracks[1],
      id: 'second-flac',
      path: '/second.flac',
    };
    const mp3Track: Track = {
      ...tracks[2],
      id: 'last-mp3',
      path: '/last.mp3',
    };
    const firstState = nativeState({ duration: 111 });
    const secondState = nativeState({ duration: 222 });
    const stalePollState = nativeState({
      position: 200,
      duration: 222,
      isPaused: false,
      terminalState: { kind: 'playing' },
    });
    let resolveFirstLoad: (state: NativeAudioState | null) => void;
    let resolveSecondPoll: (state: NativeAudioState | null) => void;
    const firstLoad = new Promise<NativeAudioState | null>((resolve) => {
      resolveFirstLoad = resolve;
    });
    const secondPoll = new Promise<NativeAudioState | null>((resolve) => {
      resolveSecondPoll = resolve;
    });

    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockImplementation((path) =>
      path === firstFlac.path ? firstLoad : Promise.resolve(secondState),
    );
    nativeAudio.getState.mockImplementationOnce(() => secondPoll);
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const firstStart = player.start([firstFlac], firstFlac.id, {
      type: 'library',
    });
    await waitForNativeOperation();
    const secondStart = player.start([secondFlac], secondFlac.id, {
      type: 'library',
    });
    await waitForNativeOperation();
    await player.start([mp3Track], mp3Track.id, { type: 'library' });

    resolveFirstLoad!(firstState);
    resolveSecondPoll!(stalePollState);
    await firstStart;
    await secondStart;
    await waitForNativeOperation();

    expect(player.getTrack()).toStrictEqual(mp3Track);
    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      duration: mp3Track.duration,
      mediaError: null,
    });
    expect(audio.src).toBe('/last.mp3');
  });

  test('ignores a delayed FLAC load rejection after switching to MP3', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'stale-failure-flac',
      path: '/stale-failure.flac',
    };
    const mp3Track: Track = {
      ...tracks[1],
      id: 'replacement-mp3',
      path: '/replacement.mp3',
    };
    let rejectLoad: (error: Error) => void;
    const pendingLoad = new Promise<NativeAudioState | null>((_, reject) => {
      rejectLoad = reject;
    });

    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockReturnValueOnce(pendingLoad);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const flacStart = player.start([flacTrack], flacTrack.id, {
      type: 'library',
    });
    await waitForNativeOperation();
    await player.start([mp3Track], mp3Track.id, { type: 'library' });

    rejectLoad!(new Error('old request failed'));
    await flacStart;

    expect(player.getTrack()).toStrictEqual(mp3Track);
    expect(player.getState().mediaError).toBeNull();
    expect(audio.src).toBe('/replacement.mp3');
  });

  test('does not let an older request for the same FLAC track overwrite a replay', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'same-flac',
      path: '/same.flac',
    };
    let resolveFirstLoad: (state: NativeAudioState | null) => void;
    const firstLoad = new Promise<NativeAudioState | null>((resolve) => {
      resolveFirstLoad = resolve;
    });

    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load
      .mockReturnValueOnce(firstLoad)
      .mockResolvedValueOnce(nativeState({ duration: 222 }));
    nativeAudio.getState.mockResolvedValue(null);
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const firstStart = player.start([flacTrack], flacTrack.id, {
      type: 'library',
    });
    await waitForNativeOperation();
    await player.start([flacTrack], flacTrack.id, { type: 'library' });

    resolveFirstLoad!(nativeState({ duration: 111 }));
    await firstStart;

    expect(nativeAudio.load.mock.calls).toStrictEqual([
      ['/same.flac', 1],
      ['/same.flac', 2],
    ]);
    expect(player.getState()).toMatchObject({
      duration: 222,
      mediaDuration: 222,
      mediaError: null,
    });
    player.stop();
  });

  test('ignores a delayed native seek result after switching tracks', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'seek-flac',
      path: '/seek.flac',
    };
    const mp3Track: Track = {
      ...tracks[1],
      id: 'seek-replacement-mp3',
      path: '/seek-replacement.mp3',
    };
    let resolveSeek: (state: NativeAudioState | null) => void;
    const delayedSeek = new Promise<NativeAudioState | null>((resolve) => {
      resolveSeek = resolve;
    });

    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockResolvedValue(nativeState({ duration: 300 }));
    nativeAudio.getState.mockResolvedValue(null);
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.seek.mockReturnValue(delayedSeek);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    await player.start([flacTrack], flacTrack.id, { type: 'library' });
    player.setCurrentTime(250);
    await player.start([mp3Track], mp3Track.id, { type: 'library' });

    resolveSeek!(
      nativeState({
        position: 250,
        duration: 300,
        isPaused: false,
        terminalState: { kind: 'playing' },
      }),
    );
    await waitForNativeOperation();

    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      duration: mp3Track.duration,
    });
    expect(audio.src).toBe('/seek-replacement.mp3');
  });

  test('treats a native failed terminal state as a media error without advancing', async () => {
    const nativeAudioBridge = (await import('../bridge-native-audio')).default;
    const nativeAudio = vi.mocked(nativeAudioBridge);
    const flacTrack: Track = {
      ...tracks[0],
      id: 'terminal-failure-flac',
      path: '/terminal-failure.flac',
    };
    nativeAudio.stop.mockResolvedValue();
    nativeAudio.load.mockResolvedValue(nativeState());
    nativeAudio.getState.mockResolvedValue(
      nativeState({
        position: 12,
        terminalState: { kind: 'failed', message: 'FLAC decoding interrupted' },
      }),
    );
    nativeAudio.play.mockResolvedValue(true);
    nativeAudio.setVolume.mockResolvedValue(true);
    nativeAudio.setPlaybackRate.mockResolvedValue(true);

    const audio = new FakeAudio();
    const player = new Player({ audio: audio as unknown as HTMLAudioElement });
    const ended = vi.fn<() => void>();
    player.on('ended', ended);

    await player.start([flacTrack], flacTrack.id, { type: 'library' });
    await waitForNativeOperation();

    expect(player.getState()).toMatchObject({
      currentTime: 0,
      mediaDuration: null,
      duration: null,
      mediaError: 'Unable to play this FLAC file: FLAC decoding interrupted',
    });
    expect(ended).not.toHaveBeenCalled();
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
