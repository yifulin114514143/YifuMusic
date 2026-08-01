import { useSuspenseQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrack from '../hooks/usePlayingTrack';
import usePlayingTrackCurrentTime from '../hooks/usePlayingTrackCurrentTime';
import DesktopLyricsBridge from '../lib/bridge-desktop-lyrics';
import LyricsBridge from '../lib/bridge-lyrics';
import TrayBridge from '../lib/bridge-tray';
import {
  createDesktopLyricsPayload,
  type DesktopLyricsKind,
} from '../lib/desktop-lyrics';
import { parseLocalLyrics, type LocalLyrics } from '../lib/lyrics/local-lyrics';
import { listenForUserSelectedLyrics } from '../lib/lyrics/user-selected-lyrics';
import player from '../lib/player';
import { configQuery } from '../lib/queries';
import { createTrayPayload, type TrayPayload } from '../lib/tray';
import { logAndNotifyError } from '../lib/utils';

const EMPTY_LYRICS: LocalLyrics = {
  kind: 'unavailable',
  lines: [],
  source: null,
  message: 'empty',
};

type LyricsForTrack = {
  trackId: string | null;
  value: LocalLyrics;
};

function toDesktopLyricsKind(lyrics: LocalLyrics): DesktopLyricsKind {
  return lyrics.kind;
}

function hasSameTrayPayload(left: TrayPayload, right: TrayPayload): boolean {
  return (
    left.trackId === right.trackId &&
    left.title === right.title &&
    left.isPaused === right.isPaused &&
    left.currentLyric === right.currentLyric &&
    left.artists.length === right.artists.length &&
    left.artists.every((artist, index) => artist === right.artists[index])
  );
}

export default function DesktopLyricsSync() {
  const statusBarLyricsEnabled =
    useSuspenseQuery(configQuery).data.status_bar_lyrics;
  const trackPlaying = usePlayingTrack();
  const currentTime = usePlayingTrackCurrentTime();
  const isPaused = usePlayerState((state) => state.isPaused);
  const trackPlayingID = trackPlaying?.id ?? null;
  const [lyricsForTrack, setLyricsForTrack] = useState<LyricsForTrack>({
    trackId: null,
    value: EMPTY_LYRICS,
  });
  const lyricsRequestGenerationRef = useRef(0);
  const latestTrackPlayingIDRef = useRef(trackPlayingID);
  const lastTraySyncRef = useRef<{
    statusBarLyricsEnabled: boolean;
    payload: TrayPayload;
  } | null>(null);
  latestTrackPlayingIDRef.current = trackPlayingID;
  const lyrics =
    lyricsForTrack.trackId === trackPlayingID
      ? lyricsForTrack.value
      : EMPTY_LYRICS;

  useEffect(() => {
    return listenForUserSelectedLyrics((selection) => {
      if (latestTrackPlayingIDRef.current !== selection.trackId) return;

      ++lyricsRequestGenerationRef.current;
      setLyricsForTrack({
        trackId: selection.trackId,
        value: selection.lyrics,
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestGeneration = ++lyricsRequestGenerationRef.current;

    if (trackPlayingID === null) {
      setLyricsForTrack({ trackId: null, value: EMPTY_LYRICS });
      return;
    }

    setLyricsForTrack({ trackId: trackPlayingID, value: EMPTY_LYRICS });
    void LyricsBridge.getSiblingLyrics(trackPlayingID)
      .then((result) => {
        if (
          cancelled ||
          lyricsRequestGenerationRef.current !== requestGeneration ||
          latestTrackPlayingIDRef.current !== trackPlayingID
        ) {
          return;
        }

        if (result.status === 'available') {
          setLyricsForTrack({
            trackId: trackPlayingID,
            value: parseLocalLyrics(result.text, result.source),
          });
          return;
        }

        setLyricsForTrack({ trackId: trackPlayingID, value: EMPTY_LYRICS });
      })
      .catch(() => {
        if (
          !cancelled &&
          lyricsRequestGenerationRef.current === requestGeneration &&
          latestTrackPlayingIDRef.current === trackPlayingID
        ) {
          setLyricsForTrack({ trackId: trackPlayingID, value: EMPTY_LYRICS });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trackPlayingID]);

  const payload = useMemo(
    () =>
      createDesktopLyricsPayload({
        track: trackPlaying,
        currentTimeSeconds: currentTime,
        isPaused,
        lyrics: {
          lyrics: lyrics.kind === 'unavailable' ? [] : lyrics.lines,
          lyricsKind: toDesktopLyricsKind(lyrics),
        },
      }),
    [currentTime, isPaused, lyrics, trackPlaying],
  );
  const trayPayload = useMemo(() => createTrayPayload(payload), [payload]);

  useEffect(() => {
    void DesktopLyricsBridge.syncState(payload).catch(() => undefined);
  }, [payload]);

  useEffect(() => {
    // The native tray command reads the persisted flag. Include it here so a
    // toggle immediately re-sends the latest playback and lyric payload.
    const previous = lastTraySyncRef.current;
    if (
      previous !== null &&
      previous.statusBarLyricsEnabled === statusBarLyricsEnabled &&
      hasSameTrayPayload(previous.payload, trayPayload)
    ) {
      return;
    }

    lastTraySyncRef.current = {
      statusBarLyricsEnabled,
      payload: { ...trayPayload, artists: [...trayPayload.artists] },
    };
    void TrayBridge.syncState(trayPayload).catch(() => undefined);
  }, [statusBarLyricsEnabled, trayPayload]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void DesktopLyricsBridge.listenForControls((action) => {
      switch (action) {
        case 'previous':
          void player.previous().catch(logAndNotifyError);
          return;
        case 'play-pause':
          void player.playPause().catch(logAndNotifyError);
          return;
        case 'next':
          void player.next().catch(logAndNotifyError);
          return;
      }
    })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return null;
}
