import { describe, expect, test, vi } from 'vite-plus/test';

import { dispatchMediaControlCommand } from '../media-control-command';

describe('native media control command dispatch', () => {
  test.each(['play', 'pause', 'previous', 'next'] as const)(
    'routes %s through the Player entry point',
    async (command) => {
      const player = {
        play: vi.fn<() => Promise<void>>().mockResolvedValue(),
        pause: vi.fn<() => void>(),
        previous: vi.fn<() => Promise<void>>().mockResolvedValue(),
        next: vi.fn<() => Promise<void>>().mockResolvedValue(),
      };

      await dispatchMediaControlCommand(command, player);

      expect(player.play).toHaveBeenCalledTimes(command === 'play' ? 1 : 0);
      expect(player.pause).toHaveBeenCalledTimes(command === 'pause' ? 1 : 0);
      expect(player.previous).toHaveBeenCalledTimes(
        command === 'previous' ? 1 : 0,
      );
      expect(player.next).toHaveBeenCalledTimes(command === 'next' ? 1 : 0);
    },
  );
});
