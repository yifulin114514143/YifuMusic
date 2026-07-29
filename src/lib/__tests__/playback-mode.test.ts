import { describe, expect, test } from 'vite-plus/test';

import {
  createPlaybackState,
  getPlaybackModeFromLegacyConfig,
  selectNextTrack,
  selectPreviousTrack,
  type PlaybackMode,
} from '../playback-mode';

const tracks = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('playback mode contract', () => {
  test('maps legacy settings to one mutually exclusive mode', () => {
    expect(getPlaybackModeFromLegacyConfig(false, 'None')).toBe('sequential');
    expect(getPlaybackModeFromLegacyConfig(true, 'None')).toBe('shuffle');
    expect(getPlaybackModeFromLegacyConfig(false, 'One')).toBe('repeat-one');
    expect(getPlaybackModeFromLegacyConfig(false, 'All')).toBe('repeat-all');
    expect(getPlaybackModeFromLegacyConfig(true, 'All')).toBe('shuffle');
  });

  test('sequential and repeat modes have deterministic transitions', () => {
    expect(
      selectNextTrack(createPlaybackState(tracks, 1, 'sequential')),
    ).toEqual({
      kind: 'track',
      index: 2,
    });
    expect(
      selectNextTrack(createPlaybackState(tracks, 3, 'sequential')),
    ).toEqual({
      kind: 'stop',
    });
    expect(
      selectNextTrack(createPlaybackState(tracks, 1, 'repeat-one')),
    ).toEqual({
      kind: 'restart',
      index: 1,
    });
    expect(
      selectNextTrack(createPlaybackState(tracks, 3, 'repeat-all')),
    ).toEqual({
      kind: 'track',
      index: 0,
    });
    expect(
      selectPreviousTrack(createPlaybackState(tracks, 0, 'repeat-all')),
    ).toEqual({
      kind: 'track',
      index: 3,
    });
  });

  test('shuffle selects dynamically from an unplayed round', () => {
    const state = createPlaybackState(tracks, 0, 'shuffle', () => 0);
    const first = selectNextTrack(state);

    expect(first.kind).toBe('track');
    expect(first.kind === 'track' && first.index).toBe(1);
    expect(state.history).toEqual([0, 1]);
    expect(state.roundPlayed).toEqual([0, 1]);
  });

  test('shuffle previous follows actual history and next after backtracking is defined', () => {
    const state = createPlaybackState(tracks, 0, 'shuffle', () => 0);
    selectNextTrack(state);
    selectNextTrack(state);

    expect(state.history).toEqual([0, 1, 2]);
    expect(selectPreviousTrack(state)).toEqual({ kind: 'track', index: 1 });
    expect(selectPreviousTrack(state)).toEqual({ kind: 'track', index: 0 });
    expect(selectPreviousTrack(state)).toEqual({ kind: 'stop' });
    expect(selectNextTrack(state)).toEqual({ kind: 'track', index: 1 });
  });

  test('single-track shuffle is downgraded to sequential', () => {
    const state = createPlaybackState([tracks[0]], 0, 'shuffle');

    expect(state.mode).toBe('sequential' satisfies PlaybackMode);
    expect(selectNextTrack(state)).toEqual({ kind: 'stop' });
  });
});
