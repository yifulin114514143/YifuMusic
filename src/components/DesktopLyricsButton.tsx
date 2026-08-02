import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';

import DesktopLyricsBridge from '../lib/bridge-desktop-lyrics';
import toastManager from '../lib/toast-manager';

export const DESKTOP_LYRICS_OPEN_TIMEOUT_MS = 8_000;

export function openDesktopLyricsWithTimeout(
  timeoutMs = DESKTOP_LYRICS_OPEN_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Desktop lyrics window open timed out'));
    }, timeoutMs);

    void DesktopLyricsBridge.open().then(
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

type Props = {
  openTimeoutMs?: number;
};

export default function DesktopLyricsButton(props: Props) {
  const { t } = useLingui();
  const [isOpening, setIsOpening] = useState(false);

  const openDesktopLyrics = () => {
    setIsOpening(true);
    void openDesktopLyricsWithTimeout(props.openTimeoutMs)
      .catch(() => {
        toastManager.add({ title: t`无法打开桌面歌词`, type: 'danger' });
      })
      .finally(() => {
        setIsOpening(false);
      });
  };

  return (
    <button
      aria-label={t`打开桌面歌词`}
      data-testid="open-desktop-lyrics-button"
      disabled={isOpening}
      data-museeks-action
      title={t`桌面歌词`}
      type="button"
      onClick={openDesktopLyrics}
      {...stylex.props(styles.button)}
    >
      <span aria-hidden="true" {...stylex.props(styles.character)}>
        词
      </span>
    </button>
  );
}

const styles = stylex.create({
  button: {
    flexShrink: 0,
    width: '32px',
    height: '32px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '999px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
      ':active': 'transparent',
    },
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transform: {
      ':hover': 'scale(1.12)',
      ':active': 'scale(0.96)',
    },
    transition: {
      default: 'transform 180ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    opacity: {
      ':disabled': 0.45,
    },
  },
  character: {
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1,
  },
});
