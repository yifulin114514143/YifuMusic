import { invoke } from '@tauri-apps/api/core';

export interface NativeAudioState {
  position: number;
  duration: number;
  isPaused: boolean;
  terminalState: NativeAudioTerminalState;
}

export type NativeAudioTerminalState =
  | { kind: 'playing' }
  | { kind: 'paused' }
  | { kind: 'ended' }
  | { kind: 'failed'; message: string };

const NativeAudioBridge = {
  load(path: string, requestId: number): Promise<NativeAudioState | null> {
    return invoke('plugin:native-audio|load', { path, requestId });
  },

  play(requestId: number): Promise<boolean> {
    return invoke('plugin:native-audio|play', { requestId });
  },

  pause(requestId: number): Promise<boolean> {
    return invoke('plugin:native-audio|pause', { requestId });
  },

  seek(position: number, requestId: number): Promise<NativeAudioState | null> {
    return invoke('plugin:native-audio|seek', { position, requestId });
  },

  getState(requestId: number): Promise<NativeAudioState | null> {
    return invoke('plugin:native-audio|get_state', { requestId });
  },

  setVolume(volume: number, requestId: number): Promise<boolean> {
    return invoke('plugin:native-audio|set_volume', { volume, requestId });
  },

  setPlaybackRate(rate: number, requestId: number): Promise<boolean> {
    return invoke('plugin:native-audio|set_playback_rate', {
      rate,
      requestId,
    });
  },

  stop(requestId: number): Promise<void> {
    return invoke('plugin:native-audio|stop', { requestId });
  },
};

export default NativeAudioBridge;
