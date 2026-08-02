import type { LocalLyrics } from './local-lyrics';

type UserSelectedLyrics = {
  trackId: string;
  lyrics: LocalLyrics;
};

type UserSelectedLyricsListener = (selection: UserSelectedLyrics) => void;

const listeners = new Set<UserSelectedLyricsListener>();

export function publishUserSelectedLyrics(selection: UserSelectedLyrics): void {
  for (const listener of listeners) {
    listener(selection);
  }
}

export function listenForUserSelectedLyrics(
  listener: UserSelectedLyricsListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
