import { convertFileSrc } from '@tauri-apps/api/core';
import { info } from '@tauri-apps/plugin-log';
import EventEmitter from 'eventemitter3';
import debounce from 'lodash-es/debounce';

import type { Repeat, Track } from '../generated/typings';
import type { QueueOrigin } from '../types/museeks';
import ConfigBridge from './bridge-config';
import MediaControlsBridge from './bridge-media-controls';
import NativeAudioBridge, {
  type NativeAudioState,
} from './bridge-native-audio';
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
  duration: number | null;
  mediaDuration: number | null;
  isMetadataLoaded: boolean;
  isSeeking: boolean;
  mediaError: string | null;
}

export type PlayerMediaError =
  | { kind: 'native'; message: string }
  | { kind: 'webkit'; error: MediaError };

export interface PlayerEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  ended: () => void;
  error: (error: PlayerMediaError) => void;
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
  private isSeekTraceActive = false;
  private nativeAudioTrackID: string | null = null;
  private nativeAudioRequestID: number | null = null;
  private nativeAudioPaused = true;
  private nativeAudioPollTimer: ReturnType<typeof setInterval> | null = null;
  private nativeAudioPollInFlight = false;
  private nativeAudioPollRequestID: number | null = null;
  private playbackRequestID = 0;
  private mediaControlsPlayback: {
    sessionID: number;
    state: 'playing' | 'paused';
    position: number;
  } | null = null;
  private mediaControlsSessionID: number | null = null;

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
      if (this.isUsingNativeAudio()) return;
      this.currentTime = 0;
      this.mediaDuration = null;
      this.isMetadataLoaded = false;
      this.isSeeking = false;
      this.mediaError = null;
      void this.syncWebKitMediaSession(this.playbackRequestID);
      this.emit('loadstart');
      this.emitStateChange();
    });
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.isUsingNativeAudio()) return;
      this.syncMediaDurationFromMetadataEvent();
    });
    this.audio.addEventListener('durationchange', () => {
      if (this.isUsingNativeAudio()) return;
      this.syncMediaDurationFromMetadataEvent();
    });
    this.audio.addEventListener('seeking', () => {
      if (this.isUsingNativeAudio()) return;
      this.isSeeking = true;
      this.traceAudio('seeking');
      this.emitStateChange();
    });
    this.audio.addEventListener('seeked', () => {
      if (this.isUsingNativeAudio()) return;
      const wasSeeking = this.isSeeking;
      this.isSeeking = false;
      const stateChanged = this.syncCurrentTime();
      this.traceAudio('seeked', { wasSeeking, stateChanged });
      this.syncMediaControlsPlayback(true);
      if (wasSeeking || stateChanged) this.emitStateChange();
    });
    this.audio.addEventListener('timeupdate', () => {
      if (this.isUsingNativeAudio()) return;
      const stateChanged = this.syncCurrentTime();
      this.traceAudio('timeupdate', { stateChanged });
      this.emit('timeupdate', this.currentTime);
      this.syncMediaControlsPlayback();
      if (stateChanged) this.emitStateChange();
    });
    this.audio.addEventListener('play', () => {
      if (this.isUsingNativeAudio()) return;
      const durationChanged = this.syncMediaDuration();
      this.traceAudio('play');
      this.emit('play');
      if (durationChanged)
        void this.syncMediaControlsMetadata(this.playbackRequestID);
      this.syncWebKitMediaSessionPlayback();
      this.syncMediaControlsPlayback(true);
      this.emitStateChange();
    });
    this.audio.addEventListener('pause', () => {
      if (this.isUsingNativeAudio()) return;
      const durationChanged = this.syncMediaDuration();
      this.traceAudio('pause');
      this.emit('pause');
      if (durationChanged)
        void this.syncMediaControlsMetadata(this.playbackRequestID);
      this.syncWebKitMediaSessionPlayback();
      this.syncMediaControlsPlayback(true);
      this.emitStateChange();
    });
    this.audio.addEventListener('ended', () => {
      if (this.isUsingNativeAudio()) return;
      this.traceAudio('ended');
      this.isSeekTraceActive = false;
      this.emit('ended');
      void this.next();
    });
    this.audio.addEventListener('error', () => {
      if (this.isUsingNativeAudio()) return;
      const error = this.audio.error;
      this.currentTime = 0;
      this.mediaDuration = null;
      this.isMetadataLoaded = false;
      this.isSeeking = false;
      this.mediaError = error?.message || 'Unable to load this track';
      this.traceAudio('error', { message: this.mediaError });
      this.emit('timeupdate', 0);
      this.clearWebKitMediaSession();
      this.clearMediaControls(this.playbackRequestID);
      if (error) this.emit('error', { kind: 'webkit', error });
      this.emitStateChange();
    });
    this.audio.addEventListener('volumechange', () => this.emitStateChange());
  }

  private getWebKitMediaSession() {
    return 'mediaSession' in navigator ? navigator.mediaSession : null;
  }

  private usesWebKitMediaSession() {
    return !this.isUsingNativeAudio() && this.getWebKitMediaSession() !== null;
  }

  private activateWebKitMediaSession(requestID: number) {
    const mediaSession = this.getWebKitMediaSession();
    if (!mediaSession || this.isUsingNativeAudio()) return;

    mediaSession.setActionHandler('play', () => {
      void this.play().catch(logAndNotifyError);
    });
    mediaSession.setActionHandler('pause', () => this.pause());
    mediaSession.setActionHandler('previoustrack', () => {
      void this.previous().catch(logAndNotifyError);
    });
    mediaSession.setActionHandler('nexttrack', () => {
      void this.next().catch(logAndNotifyError);
    });
    void this.syncWebKitMediaSession(requestID);
  }

  private clearWebKitMediaSession() {
    const mediaSession = this.getWebKitMediaSession();
    if (!mediaSession) return;

    mediaSession.setActionHandler('play', null);
    mediaSession.setActionHandler('pause', null);
    mediaSession.setActionHandler('previoustrack', null);
    mediaSession.setActionHandler('nexttrack', null);
    mediaSession.metadata = null;
    mediaSession.playbackState = 'none';
  }

  private syncWebKitMediaSessionPlayback() {
    if (!this.usesWebKitMediaSession()) return;
    const mediaSession = this.getWebKitMediaSession();
    if (!mediaSession) return;

    mediaSession.playbackState = this.audio.paused ? 'paused' : 'playing';
  }

  private async syncWebKitMediaSession(requestID: number) {
    if (
      !this.usesWebKitMediaSession() ||
      !this.isCurrentPlaybackRequest(requestID) ||
      !('MediaMetadata' in globalThis)
    ) {
      return;
    }
    const mediaSession = this.getWebKitMediaSession();
    const track = this.getTrack();
    if (!mediaSession || !track || this.mediaError !== null) return;

    try {
      const cover = await getCover(track.path);
      if (
        !this.usesWebKitMediaSession() ||
        !this.isCurrentPlaybackRequest(requestID) ||
        this.getTrack()?.id !== track.id
      ) {
        return;
      }

      mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artists.join(', '),
        album: track.album,
        artwork: cover ? [{ src: cover }] : undefined,
      });
    } catch (error) {
      logAndNotifyError(error);
    }
  }

  private syncCurrentTime() {
    const time = this.audio.currentTime;
    const currentTime = Number.isFinite(time) && time >= 0 ? time : 0;
    const currentTimeChanged = this.currentTime !== currentTime;
    this.currentTime = currentTime;
    const durationChanged = this.syncMediaDuration();
    if (durationChanged)
      void this.syncMediaControlsMetadata(this.playbackRequestID);
    return currentTimeChanged || durationChanged;
  }

  private syncMediaDurationFromMetadataEvent() {
    if (!this.syncMediaDuration(true)) return;
    void this.syncMediaControlsMetadata(this.playbackRequestID);
    this.emitStateChange();
  }

  private syncMediaDuration(metadataEvent = false) {
    const duration = this.audio.duration;
    const hasValidDuration = Number.isFinite(duration) && duration >= 0;
    if (!hasValidDuration && !metadataEvent) return false;

    const mediaDuration = hasValidDuration ? duration : null;
    const isMetadataLoaded =
      this.isMetadataLoaded || metadataEvent || hasValidDuration;
    const durationChanged = this.mediaDuration !== mediaDuration;
    const metadataChanged = this.isMetadataLoaded !== isMetadataLoaded;

    if (!durationChanged && !metadataChanged) return false;

    this.mediaDuration = mediaDuration;
    this.isMetadataLoaded = isMetadataLoaded;
    if (durationChanged) this.emit('durationchange', this.mediaDuration);
    return true;
  }

  private async syncMediaControlsMetadata(requestID: number) {
    if (this.usesWebKitMediaSession()) return;
    if (!this.isCurrentPlaybackRequest(requestID)) return;
    const track = this.getTrack();
    if (!track || this.mediaError !== null) return;

    try {
      const result = await MediaControlsBridge.setMetadata({
        sessionId: requestID,
        title: track.title,
        artist: track.artists.join(', '),
        album: track.album,
        duration: this.getTrustedDuration(),
        trackPath: track.path,
      });
      if (!result.applied || !this.isCurrentPlaybackRequest(requestID)) return;

      this.mediaControlsSessionID = requestID;
      this.syncMediaControlsPlayback(true);
    } catch (error) {
      logAndNotifyError(error);
    }
  }

  private syncMediaControlsPlayback(force = false) {
    if (this.usesWebKitMediaSession()) return;
    const track = this.getTrack();
    if (!track || this.mediaError !== null) return;
    if (this.mediaControlsSessionID !== this.playbackRequestID) return;

    const duration = this.getTrustedDuration();
    const position =
      duration === null
        ? this.currentTime
        : Math.min(this.currentTime, duration);
    const state = this.isPaused() ? 'paused' : 'playing';
    const previous = this.mediaControlsPlayback;
    if (
      !force &&
      previous?.sessionID === this.playbackRequestID &&
      previous.state === state &&
      Math.abs(previous.position - position) < 1
    ) {
      return;
    }

    this.mediaControlsPlayback = {
      sessionID: this.playbackRequestID,
      state,
      position,
    };
    void MediaControlsBridge.setPlayback({
      sessionId: this.playbackRequestID,
      state,
      position,
    }).catch(logAndNotifyError);
  }

  private clearMediaControls(sessionID: number) {
    if (this.mediaControlsSessionID === sessionID)
      this.mediaControlsSessionID = null;
    this.mediaControlsPlayback = null;
    void MediaControlsBridge.clear(sessionID).catch(logAndNotifyError);
  }

  private traceAudio(event: string, details: Record<string, unknown> = {}) {
    if (import.meta.env.MODE !== 'development' || !this.isSeekTraceActive)
      return;
    void info(
      `[YifuMusic audio seek trace] ${JSON.stringify({
        event,
        timestamp: performance.now(),
        trackID: this.getTrack()?.id ?? null,
        audioCurrentTime: this.audio.currentTime,
        audioDuration: this.audio.duration,
        playerCurrentTime: this.currentTime,
        playerDuration: this.getTrustedDuration(),
        mediaDuration: this.mediaDuration,
        isSeeking: this.isSeeking,
        isPaused: this.audio.paused,
        isEnded: this.audio.ended,
        readyState: this.audio.readyState,
        networkState: this.audio.networkState,
        buffered: this.getTimeRanges(this.audio.buffered),
        played: this.getTimeRanges(this.audio.played),
        ...details,
      })}`,
    );
  }

  private getTimeRanges(ranges: TimeRanges) {
    return Array.from({ length: ranges.length }, (_, index) => ({
      start: ranges.start(index),
      end: ranges.end(index),
    }));
  }

  private createPlaybackRequest() {
    this.playbackRequestID += 1;
    return this.playbackRequestID;
  }

  private isCurrentPlaybackRequest(requestID: number) {
    return this.playbackRequestID === requestID;
  }

  private isCurrentNativeAudioRequest(requestID: number, trackID: string) {
    return (
      this.isCurrentPlaybackRequest(requestID) &&
      this.nativeAudioRequestID === requestID &&
      this.nativeAudioTrackID === trackID
    );
  }

  private isUsingNativeAudio() {
    return (
      this.nativeAudioTrackID !== null &&
      this.nativeAudioRequestID === this.playbackRequestID
    );
  }

  private syncNativeAudioState(nativeState: NativeAudioState) {
    const duration = nativeState.duration;
    const mediaDuration =
      Number.isFinite(duration) && duration >= 0 ? duration : null;
    const position = nativeState.position;
    const currentTime =
      Number.isFinite(position) && position >= 0 ? position : this.currentTime;
    const durationChanged = this.mediaDuration !== mediaDuration;
    const metadataChanged = this.isMetadataLoaded !== (mediaDuration !== null);
    const currentTimeChanged = this.currentTime !== currentTime;
    const pauseChanged = this.nativeAudioPaused !== nativeState.isPaused;

    this.mediaDuration = mediaDuration;
    this.isMetadataLoaded = mediaDuration !== null;
    this.currentTime = currentTime;
    this.nativeAudioPaused = nativeState.isPaused;
    if (durationChanged) this.emit('durationchange', this.mediaDuration);
    if (durationChanged)
      void this.syncMediaControlsMetadata(this.playbackRequestID);

    return (
      durationChanged || metadataChanged || currentTimeChanged || pauseChanged
    );
  }

  private failNativeAudioPlayback(
    requestID: number,
    trackID: string,
    error: unknown,
  ) {
    if (!this.isCurrentNativeAudioRequest(requestID, trackID)) return;

    const detail = error instanceof Error ? error.message : String(error);
    const message = `Unable to play this FLAC file: ${detail}`;
    this.clearMediaControls(requestID);
    const cancellationRequestID = this.createPlaybackRequest();

    this.stopNativeAudioPolling();
    this.nativeAudioTrackID = null;
    this.nativeAudioRequestID = null;
    this.nativeAudioPaused = true;
    this.currentTime = 0;
    this.mediaDuration = null;
    this.isMetadataLoaded = false;
    this.isSeeking = false;
    this.mediaError = message;
    this.isSeekTraceActive = false;
    this.emit('timeupdate', 0);
    this.emit('error', { kind: 'native', message });
    this.emitStateChange();
    void NativeAudioBridge.stop(cancellationRequestID).catch(logAndNotifyError);
  }

  private handleNativeAudioState(
    nativeState: NativeAudioState,
    requestID: number,
    trackID: string,
  ) {
    if (nativeState.terminalState.kind === 'failed') {
      this.failNativeAudioPlayback(
        requestID,
        trackID,
        new Error(nativeState.terminalState.message),
      );
      return null;
    }

    return this.syncNativeAudioState(nativeState);
  }

  private startNativeAudioPolling(trackID: string, requestID: number) {
    this.stopNativeAudioPolling();
    this.nativeAudioPollRequestID = requestID;
    const poll = () => {
      if (
        this.nativeAudioPollInFlight ||
        !this.isCurrentNativeAudioRequest(requestID, trackID)
      ) {
        return;
      }
      this.nativeAudioPollInFlight = true;
      void NativeAudioBridge.getState(requestID)
        .then((nativeState) => {
          if (
            nativeState === null ||
            !this.isCurrentNativeAudioRequest(requestID, trackID)
          ) {
            return;
          }

          const stateChanged = this.handleNativeAudioState(
            nativeState,
            requestID,
            trackID,
          );
          if (stateChanged === null) return;
          this.emit('timeupdate', this.currentTime);
          this.syncMediaControlsPlayback();
          if (stateChanged) this.emitStateChange();
          if (nativeState.terminalState.kind !== 'ended') return;

          this.stopNativeAudioPolling();
          this.nativeAudioPaused = true;
          this.emit('ended');
          void this.next();
        })
        .catch((error) => {
          this.failNativeAudioPlayback(requestID, trackID, error);
        })
        .finally(() => {
          if (this.nativeAudioPollRequestID === requestID)
            this.nativeAudioPollInFlight = false;
        });
    };

    poll();
    this.nativeAudioPollTimer = setInterval(poll, 250);
  }

  private stopNativeAudioPolling() {
    if (this.nativeAudioPollTimer !== null) {
      clearInterval(this.nativeAudioPollTimer);
      this.nativeAudioPollTimer = null;
    }
    this.nativeAudioPollInFlight = false;
    this.nativeAudioPollRequestID = null;
  }

  private async stopNativeAudio(requestID: number) {
    this.stopNativeAudioPolling();
    this.nativeAudioTrackID = null;
    this.nativeAudioRequestID = null;
    this.nativeAudioPaused = true;
    await NativeAudioBridge.stop(requestID);
  }

  private syncNativeAudioVolume() {
    if (!this.isUsingNativeAudio()) return;
    const volume = this.audio.muted ? 0 : this.audio.volume;
    const requestID = this.nativeAudioRequestID;
    const trackID = this.nativeAudioTrackID;
    if (requestID === null || trackID === null) return;
    void NativeAudioBridge.setVolume(volume, requestID)
      .then((updated) => {
        if (!updated && this.isCurrentNativeAudioRequest(requestID, trackID)) {
          this.failNativeAudioPlayback(
            requestID,
            trackID,
            new Error('Native FLAC playback is no longer available'),
          );
        }
      })
      .catch((error) =>
        this.failNativeAudioPlayback(requestID, trackID, error),
      );
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
      isPaused: this.isUsingNativeAudio()
        ? this.nativeAudioPaused
        : this.audio.paused,
      currentTime: this.currentTime,
      duration: this.getTrustedDuration(),
      mediaDuration: this.mediaDuration,
      isMetadataLoaded: this.isMetadataLoaded,
      isSeeking: this.isSeeking,
      mediaError: this.mediaError,
    };
    return this.state;
  }

  async play() {
    if (this.isUsingNativeAudio()) {
      const requestID = this.nativeAudioRequestID;
      const trackID = this.nativeAudioTrackID;
      if (requestID === null || trackID === null) return;
      try {
        const started = await NativeAudioBridge.play(requestID);
        if (!this.isCurrentNativeAudioRequest(requestID, trackID)) return;
        if (!started) {
          this.failNativeAudioPlayback(
            requestID,
            trackID,
            new Error('Native FLAC playback is no longer available'),
          );
          return;
        }
      } catch (error) {
        this.failNativeAudioPlayback(requestID, trackID, error);
        return;
      }
      this.nativeAudioPaused = false;
      this.emit('play');
      this.syncMediaControlsPlayback(true);
      this.emitStateChange();
      return;
    }
    if (!this.audio.src)
      throw new Error('Trying to play a track but no audio.src is defined');
    await this.audio.play();
  }

  pause() {
    if (this.isUsingNativeAudio()) {
      const requestID = this.nativeAudioRequestID;
      const trackID = this.nativeAudioTrackID;
      if (requestID === null || trackID === null) return;
      this.nativeAudioPaused = true;
      void NativeAudioBridge.pause(requestID)
        .then((paused) => {
          if (!paused && this.isCurrentNativeAudioRequest(requestID, trackID)) {
            this.failNativeAudioPlayback(
              requestID,
              trackID,
              new Error('Native FLAC playback is no longer available'),
            );
          }
        })
        .catch((error) =>
          this.failNativeAudioPlayback(requestID, trackID, error),
        );
      this.emit('pause');
      this.syncMediaControlsPlayback(true);
      this.emitStateChange();
      return;
    }
    this.audio.pause();
  }

  stop() {
    const previousRequestID = this.playbackRequestID;
    const requestID = this.createPlaybackRequest();
    this.audio.pause();
    this.clearWebKitMediaSession();
    this.clearMediaControls(previousRequestID);
    void this.stopNativeAudio(requestID).catch(logAndNotifyError);
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
      if (this.isPaused() && this.queue.length > 0) await this.play();
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
      .then((loaded) => (loaded ? this.play() : undefined))
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
    if (!this.isUsingNativeAudio() && this.syncCurrentTime())
      this.emitStateChange();
    if (this.playbackMode === 'repeat-one' || this.currentTime >= 5) {
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
    const loaded = await this.setTrack(this.queue[queueCursor]);
    if (!loaded) return;
    await this.play().catch(logAndNotifyError);
  }

  async startFromQueue(index: number) {
    const track = this.queue[index];
    if (!track) return;
    this.queueCursor = index;
    this.resetPlaybackState();
    const loaded = await this.setTrack(track);
    if (!loaded) return;
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
    const wasUsingNativeAudio = this.isUsingNativeAudio();
    const previousRequestID = this.playbackRequestID;
    const requestID = this.createPlaybackRequest();
    this.audio.pause();
    this.clearWebKitMediaSession();
    this.clearMediaControls(previousRequestID);
    await this.stopNativeAudio(requestID);
    if (!this.isCurrentPlaybackRequest(requestID)) return false;
    this.resetMediaState();
    if (isFlacTrack(track.path)) {
      // Ignore asynchronous errors from the previous WebKit source from here on.
      this.nativeAudioTrackID = track.id;
      this.nativeAudioRequestID = requestID;
      this.audio.src = '';
      let nativeState: NativeAudioState | null;
      try {
        nativeState = await NativeAudioBridge.load(track.path, requestID);
      } catch (error) {
        this.failNativeAudioPlayback(requestID, track.id, error);
        return false;
      }
      if (!this.isCurrentNativeAudioRequest(requestID, track.id)) return false;
      if (nativeState === null) {
        this.failNativeAudioPlayback(
          requestID,
          track.id,
          new Error('Native FLAC loading was canceled'),
        );
        return false;
      }
      if (
        this.handleNativeAudioState(nativeState, requestID, track.id) === null
      ) {
        return false;
      }
      this.syncNativeAudioVolume();
      void NativeAudioBridge.setPlaybackRate(this.audio.playbackRate, requestID)
        .then((updated) => {
          if (
            !updated &&
            this.isCurrentNativeAudioRequest(requestID, track.id)
          ) {
            this.failNativeAudioPlayback(
              requestID,
              track.id,
              new Error('Native FLAC playback is no longer available'),
            );
          }
        })
        .catch((error) =>
          this.failNativeAudioPlayback(requestID, track.id, error),
        );
      this.startNativeAudioPolling(track.id, requestID);
    } else if (window.__MUSEEKS_STREAM_SERVER_URL != null) {
      if (!this.isCurrentPlaybackRequest(requestID)) return false;
      this.audio.src = `${window.__MUSEEKS_STREAM_SERVER_URL}/stream?track_id=${encodeURIComponent(track.id)}`;
    } else {
      if (!this.isCurrentPlaybackRequest(requestID)) return false;
      this.audio.src = convertFileSrc(track.path);
    }
    this.activateWebKitMediaSession(requestID);
    if (wasUsingNativeAudio && !this.isUsingNativeAudio()) this.audio.load();
    if (!this.isCurrentPlaybackRequest(requestID)) return false;
    void this.syncMediaControlsMetadata(requestID);
    if (!this.isCurrentPlaybackRequest(requestID)) return false;
    this.emit('trackChange', track);
    this.emitStateChange();
    return true;
  }

  getTrack(): Track | null {
    return this.queueCursor === null
      ? null
      : (this.queue[this.queueCursor] ?? null);
  }

  setCurrentTime(time: number) {
    if (this.isUsingNativeAudio()) {
      const target = normalizeSeekTime(
        time,
        this.mediaDuration,
        this.getTrack()?.duration ?? null,
      );
      if (target === null) return;

      this.currentTime = target;
      this.emit('timeupdate', this.currentTime);
      this.syncMediaControlsPlayback(true);
      this.emitStateChange();
      const requestID = this.nativeAudioRequestID;
      const trackID = this.nativeAudioTrackID;
      if (requestID === null || trackID === null) return;
      void NativeAudioBridge.seek(target, requestID)
        .then((nativeState) => {
          if (!this.isCurrentNativeAudioRequest(requestID, trackID)) return;
          if (nativeState === null) {
            this.failNativeAudioPlayback(
              requestID,
              trackID,
              new Error('Native FLAC seeking was canceled'),
            );
            return;
          }
          const stateChanged = this.handleNativeAudioState(
            nativeState,
            requestID,
            trackID,
          );
          if (stateChanged === null) return;
          if (stateChanged) this.emitStateChange();
          this.emit('timeupdate', this.currentTime);
          this.syncMediaControlsPlayback(true);
        })
        .catch((error) =>
          this.failNativeAudioPlayback(requestID, trackID, error),
        );
      return;
    }
    this.isSeekTraceActive = true;
    const durationChanged = this.syncMediaDuration();
    const fallbackDuration = this.getTrack()?.duration ?? null;
    const target = normalizeSeekTime(
      time,
      this.mediaDuration,
      fallbackDuration,
    );
    if (target === null) return;
    try {
      this.audio.currentTime = target;
      const stateChanged = this.syncCurrentTime();
      this.traceAudio('seek-requested', {
        requestedTime: time,
        target,
        durationChanged,
        stateChanged,
      });
      this.emit('timeupdate', this.currentTime);
      this.syncMediaControlsPlayback(true);
      if (durationChanged || stateChanged) this.emitStateChange();
    } catch {
      // Browsers can reject a seek before media metadata is available.
    }
  }

  getCurrentTime() {
    return this.currentTime;
  }
  getDuration() {
    return this.getTrustedDuration();
  }
  private getTrustedDuration() {
    if (this.mediaError !== null) return null;
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
    this.syncNativeAudioVolume();
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
    this.syncNativeAudioVolume();
    this.emitStateChange();
    await ConfigBridge.set('audio_muted', this.audio.muted);
  }

  async unmute() {
    this.audio.muted = false;
    this.syncNativeAudioVolume();
    this.emitStateChange();
    await ConfigBridge.set('audio_muted', false);
  }

  isMuted() {
    return this.audio.muted;
  }
  isPaused() {
    return this.isUsingNativeAudio()
      ? this.nativeAudioPaused
      : this.audio.paused;
  }

  async setPlaybackRate(rate: number) {
    const valid = Number.isFinite(rate) && rate >= 0.5 && rate <= 5;
    const nextRate = valid ? rate : 1;
    this.audio.playbackRate = nextRate;
    this.audio.defaultPlaybackRate = nextRate;
    if (this.isUsingNativeAudio()) {
      const requestID = this.nativeAudioRequestID;
      const trackID = this.nativeAudioTrackID;
      if (requestID !== null && trackID !== null) {
        try {
          const updated = await NativeAudioBridge.setPlaybackRate(
            nextRate,
            requestID,
          );
          if (
            !updated &&
            this.isCurrentNativeAudioRequest(requestID, trackID)
          ) {
            this.failNativeAudioPlayback(
              requestID,
              trackID,
              new Error('Native FLAC playback is no longer available'),
            );
            return;
          }
        } catch (error) {
          this.failNativeAudioPlayback(requestID, trackID, error);
          return;
        }
      }
    }
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
    this.isSeekTraceActive = false;
    this.nativeAudioTrackID = null;
    this.nativeAudioRequestID = null;
    this.nativeAudioPaused = true;
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

function isFlacTrack(path: string) {
  return path.toLowerCase().endsWith('.flac');
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
