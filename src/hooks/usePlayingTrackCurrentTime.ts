import { useEffect, useState } from 'react';

import player from '../lib/player';

/**
 * Returns the current track elapsed time
 */
export default function usePlayingTrackCurrentTime(): number {
  const [currentTime, setCurrentTime] = useState(player.getCurrentTime());

  useEffect(() => {
    function tick(time: number) {
      setCurrentTime(time);
    }
    function reset() {
      setCurrentTime(player.getCurrentTime());
    }

    player.on('timeupdate', tick);
    player.on('trackChange', reset);
    player.on('loadstart', reset);

    return () => {
      player.off('timeupdate', tick);
      player.off('trackChange', reset);
      player.off('loadstart', reset);
    };
  }, []);

  return currentTime;
}
