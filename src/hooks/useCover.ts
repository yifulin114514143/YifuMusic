import { useEffect, useState } from 'react';

import type { Track } from '../generated/typings';
import { getCover } from '../lib/cover';

type CoverLoader = (path: string) => Promise<string | null>;

/**
 * Given a track, get its associated cover as an Image src
 */
export default function useCover(
  track: Track,
  loadCover: CoverLoader = getCover,
): string | null {
  const [coverState, setCoverState] = useState({
    trackPath: track.path,
    coverPath: null as string | null,
  });

  useEffect(() => {
    let cancelled = false;
    setCoverState({ trackPath: track.path, coverPath: null });

    void loadCover(track.path).then((cover) => {
      if (!cancelled) {
        setCoverState({ trackPath: track.path, coverPath: cover });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadCover, track.path]);

  return coverState.trackPath === track.path ? coverState.coverPath : null;
}
