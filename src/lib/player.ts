import { convertFileSrc } from '@tauri-apps/api/core';
import EventEmitter from 'eventemitter3';
import debounce from 'lodash-es/debounce';

import type { Repeat, Track } from '../generated/typings';
import type { QueueOrigin } from '../types/museeks';
import ConfigBridge from './bridge-config';
import { getCover } from './cover';
import {
  createPlaybackState,
  getLegacyConfigFromPlaybackMode,
  getPlaybackModeFromLegacyConfig,
  selectNextTrack,
  selectPreviousTrack,
  type PlaybackMode,
  type PlaybackState,
  type PlaybackTransition,
} from './playback-mode';
import { getEffectiveDuration, normalizeSeekTime } from './player-contract';
import { logAndNotifyError } from './utils';

interface PlayerOptions {
  playbackRate?: number;
  volume?: number;
  muted?: boolean;
  playbackMode?: PlaybackMode;
  audio?: HTMLAudioElement;
  random?: () => number;
}

export interface PlayerState {
  queue: Track[];
  queueCursor: number | null;
  queueOrigin: QueueOrigin | null;
  playbackMode: PlaybackMode;
  volume: number;
  muted: boolean;
  isPaused: boolean;
  currentTime: number;
  mediaDuration: number | null;
  isMetadataLoaded: boolean;
  isSeeking: boolean;
  mediaError: string | null;
}

export interface PlayerEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  ended: () => void;
  error: (error: MediaError) => void;
  timeupdate: (currentTime: number) => void;
  loadstart: () => void;
  durationchange: (duration: number | null) => void;
  stateChange: (state: PlayerState) => void;
  trackChange: (track: Track | null) => void;
}

export class Player extends EventEmitter<PlayerEvents> {
  private readonly audio: HTMLAudioElement;
  private readonly random: () => number;
  private queue: Track[] = [];
  private queueCursor: number | null = null;
  private queueOrigin: QueueOrigin | null = null;
  private playbackMode: PlaybackMode;
  private playbackState: PlaybackState<Track> | null = null;
  private state: PlayerState | null = null;
  private mediaDuration: number | null = null;
  private isMetadataLoaded = false;
  private isSeeking = false;
  private currentTime = 0;
  private mediaError: string | null = null;

  constructor(options: PlayerOptions = {}) {
    super();
    this.audio = options.audio ?? new Audio();
    this.random = options.random ?? Math.random;
    this.playbackMode = options.playbackMode ?? getInitialPlaybackMode();

    const playbackRate = options.playbackRate ?? 1;
    this.audio.defaultPlaybackRate = playbackRate;
    this.audio.playbackRate = playbackRate;
    this.audio.volume = options.volume ?? 1;
    this.audio.muted = options.muted ?? false;

    this.setupAudioListeners();
    this.setupMediaSession();

    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.playPause = this.playPause.bind(this);
    this.previous = this.previous.bind(this);
    this.next = this.next.bind(this);
    this.stop = this.stop.bind(this);
    this.start = this.start.bind(this);
    this.startFromQueue = this.startFromQueue.bind(this);
    this.addToQueue = this.addToQueue.bind(this);
    this.addNextInQueue = this.addNextInQueue.bind(this);
    this.removeFromQueue = this.removeFromQueue.bind(this);
    this.clearQueue = this.clearQueue.bind(this);
    this.setQueue = this.setQueue.bind(this);
    this.setPlaybackMode = this.setPlaybackMode.bind(this);
    this.setTrack = this.setTrack.bind(this);
    this.setCurrentTime = this.setCurrentTime.bind(this);
    this.setVolume = this.setVolume.bind(this);
    this.toggleMute = this.toggleMute.bind(this);
    this.unmute = this.unmute.bind(this);
    this.setPlaybackRate = this.setPlaybackRate.bind(this);
  }

  private setupAudioListeners() {
    this.audio.addEventListener('loadstart', () => {
      this.currentTime = 0;
      this.mediaDuration = null;
      this.isMetadataLoaded = false;
      this.isSeeking = false;
      this.mediaError = null;
      this.emit('loadstart');
      this.emitStateChange();
    });
    this.audio.addEventListener('loadedmetadata', () =>
      this.syncMediaDuration(),
    );
    this.audio.addEventListener('durationchange', () =>
      this.syncMediaDuration(),
    );
    this.audio.addEventListener('seeking', () => {
      this.isSeeking = true;
      this.emitStateChange();
    });
    this.audio.addEventListener('seeked', () => {
      this.isSeeking = false;
      this.syncCurrentTime();
      this.emitStateChange();
    });
    this.audio.addEventListener('timeupdate', () => {
      this.syncCurrentTime();
      this.emit('timeupdate', this.currentTime);
      this.emitStateChange();
    });
    this.audio.addEventListener('play', () => {
      this.emit('play');
      this.emitStateChange();
    });
    this.audio.addEventListener('pause', () => {
      this.emit('pause');
      this.emitStateChange();
    });
    this.audio.addEventListener('ended', () => {
      this.emit('ended');
      void this.next();
    });
    this.audio.addEventListener('error', () => {
      const error = this.audio.error;
      this.currentTime = 0;
      this.mediaDuration = null;
      this.isMetadataLoaded = false;
      this.isSeeking = false;
      this.mediaError = error?.message || 'Unable to load this track';
      if (error) this.emit('error', error);
      this.emitStateChange();
    });
    this.audio.addEventListener('volumechange', () => this.emitStateChange());
  }

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    this.audio.addEventListener('play', () => {
      navigator.mediaSession.playbackState = 'playing';
    });
    this.audio.addEventListener('pause', () => {
      navigator.mediaSession.playbackState = 'paused';
    });
    this.audio.addEventListener('loadstart', () => {
      void this.syncMediaSession();
    });
    navigator.mediaSession.setActionHandler('play', () => {
      this.play().catch(logAndNotifyError);
    });
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.previous().catch(logAndNotifyError);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      this.next().catch(logAndNotifyError);
    });
  }

  private async syncMediaSession() {
    if (!('mediaSession' in navigator) || !('MediaMetadata' in globalThis))
      return;
    const track = this.getTrack();
    if (!track) return;
    const cover = await getCover(track.path);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artists.join(', '),
      album: track.album,
      artwork: cover ? [{ src: cover }] : undefined,
    });
  }

  private syncCurrentTime() {
    const time = this.audio.currentTime;
    this.currentTime = Number.isFinite(time) && time >= 0 ? time : 0;
  }

  private syncMediaDuration() {
    const duration = this.audio.duration;
    this.mediaDuration =
      Number.isFinite(duration) && duration >= 0 ? duration : null;
    this.isMetadataLoaded = true;
    this.emit('durationchange', this.mediaDuration);
    this.emitStateChange();
  }

  private emitStateChange() {
    this.state = null;
    this.emit('stateChange', this.getState());
  }

  getState(): PlayerState {
    if (this.state) return this.state;
    this.state = {
      queue: [...this.queue],
      queueCursor: this.queueCursor,
      queueOrigin: this.queueOrigin,
      playbackMode: this.playbackMode,
      volume: this.audio.volume,
      muted: this.audio.muted,
      isPaused: this.audio.paused,
      currentTime: this.currentTime,
      mediaDuration: this.mediaDuration,
      isMetadataLoaded: this.isMetadataLoaded,
      isSeeking: this.isSeeking,
      mediaError: this.mediaError,
    };
    return this.state;
  }

  async play() {
    if (!this.audio.src)
      throw new Error('Trying to play a track but no audio.src is defined');
    await this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.queue = [];
    this.queueCursor = null;
    this.queueOrigin = null;
    this.playbackState = null;
    this.resetMediaState();
    this.emit('trackChange', null);
    this.emit('stop');
    this.emitStateChange();
  }

  async playPause() {
    try {
      if (this.audio.paused && this.queue.length > 0) await this.play();
      else this.pause();
    } catch (error) {
      logAndNotifyError(error);
    }
  }

  private transition(transition: PlaybackTransition): Promise<void> {
    if (transition.kind === 'stop') {
      this.stop();
      return Promise.resolve();
    }
    const track = this.queue[transition.index];
    if (!track) {
      this.stop();
      return Promise.resolve();
    }
    this.queueCursor = transition.index;
    return this.setTrack(track)
      .then(() => this.play())
      .catch(logAndNotifyError);
  }

  async next() {
    if (this.queueCursor === null || this.queue.length === 0) return;
    if (!this.playbackState) {
      this.playbackState = createPlaybackState(
        this.queue,
        this.queueCursor,
        this.playbackMode,
        this.random,
      );
    }
    this.playbackState.currentIndex = this.queueCursor;
    await this.transition(selectNextTrack(this.playbackState));
  }

  async previous() {
    if (this.queueCursor === null || this.queue.length === 0) return;
    if (this.playbackMode === 'repeat-one' || this.audio.currentTime >= 5) {
      this.setCurrentTime(0);
      await this.play().catch(logAndNotifyError);
      return;
    }
    if (!this.playbackState) {
      this.playbackState = createPlaybackState(
        this.queue,
        this.queueCursor,
        this.playbackMode,
        this.random,
      );
    }
    this.playbackState.currentIndex = this.queueCursor;
    await this.transition(selectPreviousTrack(this.playbackState));
  }

  async start(
    tracks: Track[],
    trackID: string | null,
    queueOrigin: QueueOrigin,
  ) {
    if (tracks.length === 0) return;
    const queueCursor = tracks.findIndex(
      (track) => track.id === (trackID ?? tracks[0].id),
    );
    if (queueCursor === -1) return;
    this.queue = [...tracks];
    this.queueCursor = queueCursor;
    this.queueOrigin = queueOrigin;
    this.resetPlaybackState();
    await this.setTrack(this.queue[queueCursor]);
    await this.play().catch(logAndNotifyError);
  }

  async startFromQueue(index: number) {
    const track = this.queue[index];
    if (!track) return;
    this.queueCursor = index;
    this.resetPlaybackState();
    await this.setTrack(track);
    await this.play();
  }

  addToQueue(tracks: Track[]) {
    this.queue = [...this.queue, ...tracks];
    if (this.queueCursor === null && tracks.length > 0) {
      this.queueCursor = 0;
      this.resetPlaybackState();
    }
    this.emitStateChange();
  }

  addNextInQueue(tracks: Track[]) {
    if (this.queueCursor === null) {
      this.queue = [...tracks];
      this.queueCursor = tracks.length > 0 ? 0 : null;
    } else {
      this.queue.splice(this.queueCursor + 1, 0, ...tracks);
    }
    this.resetPlaybackState();
    this.emitStateChange();
  }

  removeFromQueue(index: number) {
    if (this.queueCursor === null) return;
    const absoluteIndex = this.queueCursor + index + 1;
    if (absoluteIndex < 0 || absoluteIndex >= this.queue.length) return;
    this.queue.splice(absoluteIndex, 1);
    this.resetPlaybackState();
    this.emitStateChange();
  }

  clearQueue() {
    if (this.queueCursor === null) return;
    this.queue = this.queue.slice(0, this.queueCursor + 1);
    this.resetPlaybackState();
    this.emitStateChange();
  }

  setQueue(tracks: Track[]) {
    const currentID = this.getTrack()?.id;
    this.queue = [...tracks];
    this.queueCursor =
      currentID == null
        ? null
        : this.queue.findIndex((track) => track.id === currentID);
    if (this.queueCursor === -1)
      this.queueCursor = this.queue.length > 0 ? 0 : null;
    this.resetPlaybackState();
    this.emitStateChange();
  }

  getQueue() {
    return [...this.queue];
  }
  getQueueCursor() {
    return this.queueCursor;
  }
  getQueueOrigin() {
    return this.queueOrigin;
  }

  async setPlaybackMode(mode: PlaybackMode) {
    const nextMode =
      mode === 'shuffle' && this.queue.length < 2 ? 'sequential' : mode;
    this.playbackMode = nextMode;
    this.resetPlaybackState();
    this.emitStateChange();
    await ConfigBridge.multiSet({
      audio_playback_mode: nextMode,
      ...getLegacyConfigFromPlaybackMode(nextMode),
    });
  }

  getPlaybackMode() {
    return this.playbackMode;
  }

  async toggleShuffle() {
    await this.setPlaybackMode(
      this.playbackMode === 'shuffle' ? 'sequential' : 'shuffle',
    );
  }

  async toggleRepeat() {
    const next: PlaybackMode =
      this.playbackMode === 'sequential'
        ? 'repeat-all'
        : this.playbackMode === 'repeat-all'
          ? 'repeat-one'
          : 'sequential';
    await this.setPlaybackMode(next);
  }

  getShuffle() {
    return this.playbackMode === 'shuffle';
  }
  getRepeat(): Repeat {
    if (this.playbackMode === 'repeat-one') return 'One';
    if (this.playbackMode === 'repeat-all') return 'All';
    return 'None';
  }

  async setTrack(track: Track) {
    this.resetMediaState();
    if (window.__MUSEEKS_STREAM_SERVER_URL != null) {
      this.audio.src = `${window.__MUSEEKS_STREAM_SERVER_URL}/stream?track_id=${encodeURIComponent(track.id)}`;
    } else {
      this.audio.src = convertFileSrc(track.path);
    }
    this.emit('trackChange', track);
    this.emitStateChange();
  }

  getTrack(): Track | null {
    return this.queueCursor === null
      ? null
      : (this.queue[this.queueCursor] ?? null);
  }

  setCurrentTime(time: number) {
    const fallbackDuration = this.getTrack()?.duration ?? null;
    const target = normalizeSeekTime(
      time,
      this.mediaDuration,
      fallbackDuration,
    );
    if (target === null) return;
    try {
      this.audio.currentTime = target;
      this.currentTime = target;
      this.emit('timeupdate', this.currentTime);
      this.emitStateChange();
    } catch {
      // Browsers can reject a seek before media metadata is available.
    }
  }

  getCurrentTime() {
    return this.currentTime;
  }
  getDuration() {
    return getEffectiveDuration(
      this.getTrack()?.duration ?? 0,
      this.mediaDuration,
      this.isMetadataLoaded,
    );
  }
  getMediaDuration() {
    return this.mediaDuration;
  }
  isMetadataReady() {
    return this.isMetadataLoaded;
  }
  isCurrentlySeeking() {
    return this.isSeeking;
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
    this.emitStateChange();
    this.saveVolumeDebounced(this.audio.volume);
  }

  private readonly saveVolumeDebounced = debounce((volume: number) => {
    void ConfigBridge.set('audio_volume', volume);
  }, 500);

  getVolume() {
    return this.audio.volume;
  }

  async toggleMute() {
    this.audio.muted = !this.audio.muted;
    this.emitStateChange();
    await ConfigBridge.set('audio_muted', this.audio.muted);
  }

  async unmute() {
    this.audio.muted = false;
    this.emitStateChange();
    await ConfigBridge.set('audio_muted', false);
  }

  isMuted() {
    return this.audio.muted;
  }
  isPaused() {
    return this.audio.paused;
  }

  async setPlaybackRate(rate: number) {
    const valid = Number.isFinite(rate) && rate >= 0.5 && rate <= 5;
    const nextRate = valid ? rate : 1;
    this.audio.playbackRate = nextRate;
    this.audio.defaultPlaybackRate = nextRate;
    this.emitStateChange();
    await ConfigBridge.set('audio_playback_rate', valid ? rate : null);
  }

  getPlaybackRate() {
    return this.audio.playbackRate;
  }

  private resetMediaState() {
    this.currentTime = 0;
    this.mediaDuration = null;
    this.isMetadataLoaded = false;
    this.isSeeking = false;
    this.mediaError = null;
  }

  private resetPlaybackState() {
    if (this.queueCursor === null || this.queue.length === 0) {
      this.playbackState = null;
      return;
    }
    this.playbackState = createPlaybackState(
      this.queue,
      this.queueCursor,
      this.playbackMode,
      this.random,
    );
  }
}

function getInitialPlaybackMode(): PlaybackMode {
  const config = window.__MUSEEKS_INITIAL_CONFIG as Partial<{
    audio_playback_mode: PlaybackMode;
    audio_shuffle: boolean;
    audio_repeat: Repeat;
  }>;
  if (
    config.audio_playback_mode === 'sequential' ||
    config.audio_playback_mode === 'shuffle' ||
    config.audio_playback_mode === 'repeat-one' ||
    config.audio_playback_mode === 'repeat-all'
  ) {
    return config.audio_playback_mode;
  }
  return getPlaybackModeFromLegacyConfig(
    config.audio_shuffle ?? false,
    config.audio_repeat ?? 'None',
  );
}

const playerInstance = new Player({
  volume: ConfigBridge.getInitial('audio_volume'),
  playbackRate: ConfigBridge.getInitial('audio_playback_rate') ?? 1,
  muted: ConfigBridge.getInitial('audio_muted'),
  playbackMode: getInitialPlaybackMode(),
});

export type PlayerInstance = InstanceType<typeof Player>;

export default playerInstance;
window.__MUSEEKS_PLAYER = playerInstance;
