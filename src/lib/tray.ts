import {
  getDesktopLyricsDisplay,
  type DesktopLyricsPayload,
} from './desktop-lyrics';

export type TrayPayload = {
  trackId: string | null;
  title: string;
  artists: Array<string>;
  isPaused: boolean;
  currentLyric: string;
};

export function createTrayPayload(payload: DesktopLyricsPayload): TrayPayload {
  const currentLyric =
    payload.trackId === null
      ? ''
      : (getDesktopLyricsDisplay(payload).currentLine?.text.trim() ?? '');

  return {
    trackId: payload.trackId,
    title: payload.title,
    artists: payload.artists,
    isPaused: payload.isPaused,
    currentLyric,
  };
}
