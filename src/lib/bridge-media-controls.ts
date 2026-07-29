import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type MediaControlCommand = 'play' | 'pause' | 'previous' | 'next';

export interface MediaControlsMetadata {
  sessionId: number;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  trackPath: string;
}

export interface MediaControlsPlayback {
  sessionId: number;
  state: 'playing' | 'paused';
  position: number;
}

export interface MediaControlsUpdateResult {
  supported: boolean;
  applied: boolean;
  reason: string | null;
}

const mediaControlCommands: ReadonlySet<string> = new Set([
  'play',
  'pause',
  'previous',
  'next',
]);

function isMediaControlCommand(value: unknown): value is MediaControlCommand {
  return typeof value === 'string' && mediaControlCommands.has(value);
}

const MediaControlsBridge = {
  setMetadata: (
    metadata: MediaControlsMetadata,
  ): Promise<MediaControlsUpdateResult> =>
    invoke('plugin:media-controls|set_metadata', { metadata }),

  setPlayback: (
    playback: MediaControlsPlayback,
  ): Promise<MediaControlsUpdateResult> =>
    invoke('plugin:media-controls|set_playback', { playback }),

  clear: (sessionId: number): Promise<MediaControlsUpdateResult> =>
    invoke('plugin:media-controls|clear', { sessionId }),

  listenToCommands: (handler: (command: MediaControlCommand) => void) =>
    listen<unknown>('media-controls://command', ({ payload }) => {
      if (isMediaControlCommand(payload)) handler(payload);
    }),
};

export default MediaControlsBridge;
