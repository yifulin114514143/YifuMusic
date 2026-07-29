import type { Repeat } from '../generated/typings';

export type PlaybackMode =
  | 'sequential'
  | 'shuffle'
  | 'repeat-one'
  | 'repeat-all';

export type PlaybackTrack = { id: string };

export type PlaybackTransition =
  | { kind: 'track'; index: number }
  | { kind: 'restart'; index: number }
  | { kind: 'stop' };

export interface PlaybackState<T extends PlaybackTrack> {
  tracks: T[];
  currentIndex: number;
  mode: PlaybackMode;
  history: number[];
  historyCursor: number;
  roundPlayed: number[];
  random: () => number;
}

export function getPlaybackModeFromLegacyConfig(
  shuffle: boolean,
  repeat: Repeat,
): PlaybackMode {
  if (shuffle) return 'shuffle';
  if (repeat === 'One') return 'repeat-one';
  if (repeat === 'All') return 'repeat-all';
  return 'sequential';
}

export function getLegacyConfigFromPlaybackMode(mode: PlaybackMode): {
  audio_shuffle: boolean;
  audio_repeat: Repeat;
} {
  switch (mode) {
    case 'shuffle':
      return { audio_shuffle: true, audio_repeat: 'None' };
    case 'repeat-one':
      return { audio_shuffle: false, audio_repeat: 'One' };
    case 'repeat-all':
      return { audio_shuffle: false, audio_repeat: 'All' };
    case 'sequential':
      return { audio_shuffle: false, audio_repeat: 'None' };
  }
}

export function createPlaybackState<T extends PlaybackTrack>(
  tracks: T[],
  currentIndex: number,
  mode: PlaybackMode,
  random = Math.random,
): PlaybackState<T> {
  const normalizedMode =
    mode === 'shuffle' && tracks.length < 2 ? 'sequential' : mode;
  const safeIndex = Math.max(0, Math.min(currentIndex, tracks.length - 1));

  return {
    tracks,
    currentIndex: safeIndex,
    mode: normalizedMode,
    history: [safeIndex],
    historyCursor: 0,
    roundPlayed: [safeIndex],
    random,
  };
}

function chooseRandom<T extends PlaybackTrack>(
  state: PlaybackState<T>,
): number | null {
  if (state.tracks.length < 2) return null;

  let candidates = state.tracks
    .map((_track, index) => index)
    .filter(
      (index) =>
        index !== state.currentIndex && !state.roundPlayed.includes(index),
    );

  if (candidates.length === 0) {
    state.roundPlayed = [state.currentIndex];
    candidates = state.tracks
      .map((_track, index) => index)
      .filter((index) => index !== state.currentIndex);
  }

  const randomIndex = Math.min(
    candidates.length - 1,
    Math.floor(
      Math.max(0, Math.min(0.999999, state.random())) * candidates.length,
    ),
  );
  return candidates[randomIndex] ?? null;
}

function recordTrack<T extends PlaybackTrack>(
  state: PlaybackState<T>,
  index: number,
): PlaybackTransition {
  if (state.historyCursor < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyCursor + 1);
  }
  state.history.push(index);
  state.historyCursor = state.history.length - 1;
  state.currentIndex = index;
  if (!state.roundPlayed.includes(index)) state.roundPlayed.push(index);
  return { kind: 'track', index };
}

export function selectNextTrack<T extends PlaybackTrack>(
  state: PlaybackState<T>,
): PlaybackTransition {
  if (state.tracks.length === 0) return { kind: 'stop' };

  switch (state.mode) {
    case 'repeat-one':
      return { kind: 'restart', index: state.currentIndex };
    case 'repeat-all':
      return recordTrack(state, (state.currentIndex + 1) % state.tracks.length);
    case 'shuffle': {
      if (state.historyCursor < state.history.length - 1) {
        state.historyCursor += 1;
        state.currentIndex =
          state.history[state.historyCursor] ?? state.currentIndex;
        return { kind: 'track', index: state.currentIndex };
      }
      const index = chooseRandom(state);
      return index === null ? { kind: 'stop' } : recordTrack(state, index);
    }
    case 'sequential': {
      const index = state.currentIndex + 1;
      return index < state.tracks.length
        ? recordTrack(state, index)
        : { kind: 'stop' };
    }
  }
}

export function selectPreviousTrack<T extends PlaybackTrack>(
  state: PlaybackState<T>,
): PlaybackTransition {
  if (state.tracks.length === 0) return { kind: 'stop' };

  if (state.mode === 'repeat-one') {
    return { kind: 'restart', index: state.currentIndex };
  }

  if (state.mode === 'shuffle') {
    if (state.historyCursor === 0) return { kind: 'stop' };
    state.historyCursor -= 1;
    state.currentIndex =
      state.history[state.historyCursor] ?? state.currentIndex;
    return { kind: 'track', index: state.currentIndex };
  }

  const index =
    state.mode === 'repeat-all'
      ? (state.currentIndex - 1 + state.tracks.length) % state.tracks.length
      : state.currentIndex - 1;
  return index >= 0 ? recordTrack(state, index) : { kind: 'stop' };
}
