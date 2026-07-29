import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import { useAppShell } from './AppShellContext';
import Cover from './Cover';
import Queue from './Queue';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function QueuePanel() {
  const { t } = useLingui();
  const { queueOpen, shouldFocusQueue, closeQueue } = useAppShell();
  const queue = usePlayerState((state) => state.queue);
  const queueCursor = usePlayerState((state) => state.queueCursor);
  const isPaused = usePlayerState((state) => state.isPaused);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isWideLayout, setIsWideLayout] = useState(
    () => window.innerWidth >= 1180,
  );

  const currentTrack =
    queueCursor === null ? null : (queue[queueCursor] ?? null);

  useEffect(() => {
    if (queueOpen && shouldFocusQueue) closeButtonRef.current?.focus();
  }, [queueOpen, shouldFocusQueue]);

  useEffect(() => {
    if (!queueOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeQueue();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeQueue, queueOpen]);

  useEffect(() => {
    let isWideLayout = window.innerWidth >= 1180;

    const updateLayout = () => {
      const nextIsWideLayout = window.innerWidth >= 1180;

      if (nextIsWideLayout === isWideLayout) return;

      isWideLayout = nextIsWideLayout;
      setIsWideLayout(nextIsWideLayout);
    };

    window.addEventListener('resize', updateLayout);
    return () => {
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  const trapModalFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (isWideLayout || event.key !== 'Tab') return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(
      (element) =>
        !element.hasAttribute('disabled') &&
        element.getClientRects().length > 0,
    );

    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      {queueOpen && (
        <button
          aria-label={t`Close queue`}
          type="button"
          onClick={closeQueue}
          {...stylex.props(styles.backdrop)}
        />
      )}
      {queueOpen && (
        <aside
          aria-label={t`Queue`}
          aria-modal={!isWideLayout ? true : undefined}
          role={isWideLayout ? 'complementary' : 'dialog'}
          onKeyDown={trapModalFocus}
          {...stylex.props(styles.panel)}
        >
          <header {...stylex.props(styles.header)}>
            <div {...stylex.props(styles.heading)}>
              <span {...stylex.props(styles.title)}>{t`Queue`}</span>
              <span {...stylex.props(styles.count)}>
                {plural(queue.length, {
                  one: '# track',
                  other: '# tracks',
                })}
              </span>
            </div>
            <ButtonIcon
              ref={closeButtonRef}
              icon="chevronDown"
              iconSize={20}
              label={t`Collapse queue`}
              onClick={closeQueue}
              xstyle={styles.closeButton}
            />
          </header>
          {currentTrack !== null && (
            <section
              aria-label={t`Now playing`}
              data-playback-state={isPaused ? 'paused' : 'playing'}
              {...stylex.props(styles.nowPlaying)}
            >
              <div {...stylex.props(styles.cover)}>
                <Cover track={currentTrack} iconSize={16} />
              </div>
              <div {...stylex.props(styles.nowPlayingInfo)}>
                <div {...stylex.props(styles.nowPlayingHeading)}>
                  <span {...stylex.props(styles.nowPlayingLabel)}>
                    {t`Now playing`}
                  </span>
                  <span {...stylex.props(styles.playbackStatus)}>
                    {isPaused ? t`Paused` : t`Playing`}
                  </span>
                </div>
                <strong
                  title={currentTrack.title}
                  {...stylex.props(styles.trackTitle)}
                >
                  {currentTrack.title}
                </strong>
                <span
                  title={currentTrack.artists.join(', ')}
                  {...stylex.props(styles.trackMeta)}
                >
                  {currentTrack.artists.join(', ')}
                </span>
              </div>
            </section>
          )}
          <Queue queue={queue} queueCursor={queueCursor} />
        </aside>
      )}
    </>
  );
}

const styles = stylex.create({
  backdrop: {
    display: {
      default: 'none',
      '@media (max-width: 1179px)': 'block',
    },
    position: {
      default: 'static',
      '@media (max-width: 1179px)': 'fixed',
    },
    inset: {
      '@media (max-width: 1179px)': 0,
    },
    bottom: {
      '@media (max-width: 1179px)': '84px',
    },
    zIndex: {
      '@media (max-width: 1179px)': 20,
    },
    borderStyle: 'none',
    backgroundColor: {
      default: 'transparent',
      '@media (max-width: 1179px)': 'rgba(9, 12, 15, 0.4)',
    },
    cursor: 'default',
  },
  panel: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--border-subtle)',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: 'var(--shadow-panel)',
    position: {
      default: 'relative',
      '@media (max-width: 1179px)': 'fixed',
    },
    top: {
      '@media (max-width: 1179px)': 0,
    },
    right: {
      '@media (max-width: 1179px)': 0,
    },
    bottom: {
      '@media (max-width: 1179px)': '84px',
    },
    width: {
      '@media (max-width: 1179px)': 'min(360px, calc(100vw - 24px))',
    },
    zIndex: {
      '@media (max-width: 1179px)': 21,
    },
    transform: {
      '@media (max-width: 1179px)': 'translateX(0)',
    },
    transition: {
      '@media (max-width: 1179px)': 'transform 160ms ease-out',
    },
  },
  header: {
    minHeight: '56px',
    paddingBlock: '12px',
    paddingInline: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  heading: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: '8px',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: 700,
  },
  count: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
  },
  closeButton: {
    borderRadius: 'var(--radius-sm)',
  },
  nowPlaying: {
    margin: '12px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-subtle)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
  },
  cover: {
    width: '40px',
    height: '40px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
  },
  nowPlayingInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
  },
  nowPlayingLabel: {
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 700,
  },
  nowPlayingHeading: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '6px',
  },
  playbackStatus: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
  },
  trackTitle: {
    minWidth: 0,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackMeta: {
    minWidth: 0,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
  },
});
