import type { MediaControlCommand } from './bridge-media-controls';

export interface PlayerMediaControlTarget {
  play(): Promise<void>;
  pause(): void;
  previous(): Promise<void>;
  next(): Promise<void>;
}

export async function dispatchMediaControlCommand(
  command: MediaControlCommand,
  player: PlayerMediaControlTarget,
) {
  switch (command) {
    case 'play':
      await player.play();
      return;
    case 'pause':
      player.pause();
      return;
    case 'previous':
      await player.previous();
      return;
    case 'next':
      await player.next();
  }
}
