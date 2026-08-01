import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import type { Track } from '../generated/typings';
import useCover from '../hooks/useCover';
import useFormattedDuration from '../hooks/useFormattedDuration';
import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrack from '../hooks/usePlayingTrack';
import usePlayingTrackCurrentTime from '../hooks/usePlayingTrackCurrentTime';
import LyricsBridge, { type LyricsReadResult } from '../lib/bridge-lyrics';
import {
  findCurrentLyricLineIndex,
  parseLocalLyrics,
  type LocalLyrics,
} from '../lib/lyrics/local-lyrics';
import { publishUserSelectedLyrics } from '../lib/lyrics/user-selected-lyrics';
import player from '../lib/player';
import ButtonPlaybackMode from './ButtonPlaybackMode';
import ButtonShuffle from './ButtonShuffle';
import Cover from './Cover';
import PlayerControls from './PlayerControls';
import Queue from './Queue';
import TrackProgress from './TrackProgress';

type Props = {
  onClose: () => void;
};

type LyricsLoadState = 'loading' | 'ready' | 'unavailable' | 'failed';

type FullscreenLyricsSettings = {
  background: 'on' | 'cover' | 'off';
  fontSize: '20px' | '24px' | '32px';
  align: 'left' | 'center';
  displayMode: 'scroll' | 'single';
};

const FULLSCREEN_LYRICS_SETTINGS_STORAGE_KEY = 'fullscreen-lyrics-settings';
const DEFAULT_FULLSCREEN_LYRICS_SETTINGS: FullscreenLyricsSettings = {
  background: 'on',
  fontSize: '24px',
  align: 'center',
  displayMode: 'scroll',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function formatLyricTimestamp(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getFullscreenLyricsSettings(): FullscreenLyricsSettings {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(FULLSCREEN_LYRICS_SETTINGS_STORAGE_KEY) ??
        '{}',
    ) as Record<string, unknown>;

    return {
      background:
        saved.background === 'cover' || saved.background === 'off'
          ? saved.background
          : DEFAULT_FULLSCREEN_LYRICS_SETTINGS.background,
      fontSize:
        saved.fontSize === '20px' ||
        saved.fontSize === '24px' ||
        saved.fontSize === '32px'
          ? saved.fontSize
          : DEFAULT_FULLSCREEN_LYRICS_SETTINGS.fontSize,
      align:
        saved.align === 'left'
          ? saved.align
          : DEFAULT_FULLSCREEN_LYRICS_SETTINGS.align,
      displayMode:
        saved.displayMode === 'single'
          ? saved.displayMode
          : DEFAULT_FULLSCREEN_LYRICS_SETTINGS.displayMode,
    };
  } catch {
    return DEFAULT_FULLSCREEN_LYRICS_SETTINGS;
  }
}

function NowPlayingBackdrop({
  track,
  background,
}: {
  track: Track;
  background: FullscreenLyricsSettings['background'];
}) {
  const coverPath = useCover(track);

  if (background === 'off') return null;

  return (
    <div
      aria-hidden="true"
      data-lyrics-background={background}
      {...stylex.props(
        styles.backdrop,
        background === 'cover' && styles.backdropCover,
      )}
      style={
        coverPath === null
          ? undefined
          : { backgroundImage: `url(${coverPath})` }
      }
    />
  );
}

function FullscreenLyricsSettings({
  isOpen,
  isTimedLyrics,
  panelRef,
  settings,
  suppressNextTriggerFocusOpenRef,
  triggerRef,
  onOpenChange,
  onSettingsChange,
}: {
  isOpen: boolean;
  isTimedLyrics: boolean;
  panelRef: RefObject<HTMLElement | null>;
  settings: FullscreenLyricsSettings;
  suppressNextTriggerFocusOpenRef: { current: boolean };
  triggerRef: RefObject<HTMLButtonElement | null>;
  onOpenChange: (isOpen: boolean) => void;
  onSettingsChange: (settings: FullscreenLyricsSettings) => void;
}) {
  const { t } = useLingui();

  const updateSettings = (updates: Partial<FullscreenLyricsSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  };
  const effectiveDisplayMode = isTimedLyrics ? settings.displayMode : 'scroll';

  return (
    <div
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onOpenChange(false);
        }
      }}
      {...stylex.props(styles.lyricsSettingsControl)}
    >
      <span
        aria-hidden="true"
        {...stylex.props(styles.lyricsSettingsGuideAnchor)}
      />
      <ButtonIcon
        ref={triggerRef}
        aria-expanded={isOpen}
        icon="settings"
        iconSize={16}
        label={t`歌词显示设置`}
        onClick={() => onOpenChange(true)}
        onFocus={() => {
          if (suppressNextTriggerFocusOpenRef.current) {
            suppressNextTriggerFocusOpenRef.current = false;
            return;
          }

          onOpenChange(true);
        }}
      />
      {isOpen && (
        <section
          ref={panelRef}
          aria-label={t`歌词显示设置`}
          data-testid="fullscreen-lyrics-settings"
          role="region"
          {...stylex.props(styles.lyricsSettingsPanel)}
        >
          <h2 {...stylex.props(styles.lyricsSettingsHeading)}>
            {t`歌词显示设置`}
          </h2>

          <section {...stylex.props(styles.lyricsSettingsRow)}>
            <span {...stylex.props(styles.lyricsSettingsLabel)}>{t`背景`}</span>
            <div
              aria-label={t`歌词背景`}
              role="group"
              {...stylex.props(
                styles.lyricsSettingsOptions,
                styles.lyricsSettingsOptionsThree,
              )}
            >
              <button
                aria-label={t`背景：开启`}
                aria-pressed={settings.background === 'on'}
                title={t`背景：开启`}
                type="button"
                onClick={() => updateSettings({ background: 'on' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.background === 'on' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`开启`}
              </button>
              <button
                aria-label={t`背景：封面`}
                aria-pressed={settings.background === 'cover'}
                title={t`背景：封面`}
                type="button"
                onClick={() => updateSettings({ background: 'cover' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.background === 'cover' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`封面`}
              </button>
              <button
                aria-label={t`背景：关闭`}
                aria-pressed={settings.background === 'off'}
                title={t`背景：关闭`}
                type="button"
                onClick={() => updateSettings({ background: 'off' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.background === 'off' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`关闭`}
              </button>
            </div>
          </section>

          <section {...stylex.props(styles.lyricsSettingsRow)}>
            <span {...stylex.props(styles.lyricsSettingsLabel)}>
              {t`字体大小`}
            </span>
            <div
              aria-label={t`歌词字体大小`}
              role="group"
              {...stylex.props(
                styles.lyricsSettingsOptions,
                styles.lyricsSettingsOptionsThree,
              )}
            >
              <button
                aria-label={t`字体大小：小`}
                aria-pressed={settings.fontSize === '20px'}
                title={t`字体大小：小`}
                type="button"
                onClick={() => updateSettings({ fontSize: '20px' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.fontSize === '20px' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`小`}
              </button>
              <button
                aria-label={t`字体大小：中`}
                aria-pressed={settings.fontSize === '24px'}
                title={t`字体大小：中`}
                type="button"
                onClick={() => updateSettings({ fontSize: '24px' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.fontSize === '24px' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`中`}
              </button>
              <button
                aria-label={t`字体大小：大`}
                aria-pressed={settings.fontSize === '32px'}
                title={t`字体大小：大`}
                type="button"
                onClick={() => updateSettings({ fontSize: '32px' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.fontSize === '32px' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`大`}
              </button>
            </div>
          </section>

          <section {...stylex.props(styles.lyricsSettingsRow)}>
            <span {...stylex.props(styles.lyricsSettingsLabel)}>
              {t`显示方式`}
            </span>
            <div
              aria-label={t`歌词显示方式`}
              role="group"
              {...stylex.props(
                styles.lyricsSettingsOptions,
                styles.lyricsSettingsOptionsTwo,
              )}
            >
              <button
                aria-label={t`显示方式：滚动`}
                aria-pressed={effectiveDisplayMode === 'scroll'}
                title={t`显示方式：滚动`}
                type="button"
                onClick={() => updateSettings({ displayMode: 'scroll' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  effectiveDisplayMode === 'scroll' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`滚动`}
              </button>
              <button
                aria-label={
                  isTimedLyrics
                    ? t`显示方式：单行`
                    : t`纯文本歌词无法定位当前行，单行模式不可用`
                }
                aria-pressed={effectiveDisplayMode === 'single'}
                disabled={!isTimedLyrics}
                title={
                  isTimedLyrics
                    ? t`显示方式：单行`
                    : t`纯文本歌词无法定位当前行，单行模式不可用`
                }
                type="button"
                onClick={() => updateSettings({ displayMode: 'single' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  effectiveDisplayMode === 'single' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`单行`}
              </button>
            </div>
          </section>

          <section {...stylex.props(styles.lyricsSettingsRow)}>
            <span {...stylex.props(styles.lyricsSettingsLabel)}>
              {t`对齐方式`}
            </span>
            <div
              aria-label={t`歌词对齐方式`}
              role="group"
              {...stylex.props(
                styles.lyricsSettingsOptions,
                styles.lyricsSettingsOptionsTwo,
              )}
            >
              <button
                aria-label={t`对齐方式：居左`}
                aria-pressed={settings.align === 'left'}
                title={t`对齐方式：居左`}
                type="button"
                onClick={() => updateSettings({ align: 'left' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.align === 'left' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`居左`}
              </button>
              <button
                aria-label={t`对齐方式：居中`}
                aria-pressed={settings.align === 'center'}
                title={t`对齐方式：居中`}
                type="button"
                onClick={() => updateSettings({ align: 'center' })}
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  settings.align === 'center' &&
                    styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`居中`}
              </button>
            </div>
          </section>

          <section {...stylex.props(styles.lyricsSettingsRow)}>
            <span {...stylex.props(styles.lyricsSettingsLabel)}>
              {t`高亮方式`}
            </span>
            <div
              aria-label={t`歌词高亮方式`}
              role="group"
              {...stylex.props(
                styles.lyricsSettingsOptions,
                styles.lyricsSettingsOptionsTwo,
              )}
            >
              <button
                aria-label={t`高亮方式：逐行`}
                aria-pressed="true"
                disabled
                title={t`当前本地歌词只提供逐行时间，逐字高亮不可用`}
                type="button"
                {...stylex.props(
                  styles.lyricsSettingsOption,
                  styles.lyricsSettingsOptionSelected,
                )}
              >
                {t`逐行`}
              </button>
              <button
                aria-label={t`当前本地歌词只提供逐行时间，逐字高亮不可用`}
                aria-pressed="false"
                disabled
                title={t`当前本地歌词只提供逐行时间，逐字高亮不可用`}
                type="button"
                {...stylex.props(styles.lyricsSettingsOption)}
              >
                {t`逐字`}
              </button>
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

function OverlayQueueContent({
  currentTrack,
  isPaused,
  queue,
  queueCursor,
  onClose,
  closeButtonRef,
}: {
  currentTrack: Track | null;
  isPaused: boolean;
  queue: Array<Track>;
  queueCursor: number | null;
  onClose: () => void;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useLingui();

  return (
    <>
      <header {...stylex.props(styles.queueHeader)}>
        <div {...stylex.props(styles.queueHeading)}>
          <span {...stylex.props(styles.queueTitle)}>{t`Queue`}</span>
          <span {...stylex.props(styles.queueCount)}>
            {plural(queue.length, {
              one: '# track',
              other: '# tracks',
            })}
          </span>
        </div>
        <ButtonIcon
          ref={closeButtonRef}
          icon="close"
          iconSize={20}
          label={t`Close queue`}
          onClick={onClose}
        />
      </header>
      {currentTrack !== null && (
        <section
          aria-label={t`Now playing`}
          data-playback-state={isPaused ? 'paused' : 'playing'}
          {...stylex.props(styles.queueNowPlaying)}
        >
          <div {...stylex.props(styles.queueCover)}>
            <Cover track={currentTrack} iconSize={16} />
          </div>
          <div {...stylex.props(styles.queueTrackInfo)}>
            <span {...stylex.props(styles.queueStatus)}>
              {isPaused ? t`Paused` : t`Playing`}
            </span>
            <strong
              title={currentTrack.title}
              {...stylex.props(styles.queueTrackTitle)}
            >
              {currentTrack.title}
            </strong>
            <span
              title={currentTrack.artists.join(', ')}
              {...stylex.props(styles.queueTrackMeta)}
            >
              {currentTrack.artists.join(', ')}
            </span>
          </div>
        </section>
      )}
      <Queue queue={queue} queueCursor={queueCursor} />
    </>
  );
}

export default function NowPlayingOverlay({ onClose }: Props) {
  const { t } = useLingui();
  const trackPlaying = usePlayingTrack();
  const queue = usePlayerState((state) => state.queue);
  const queueCursor = usePlayerState((state) => state.queueCursor);
  const duration = usePlayerState((state) => state.duration);
  const isPaused = usePlayerState((state) => state.isPaused);
  const mediaError = usePlayerState((state) => state.mediaError);
  const currentTime = usePlayingTrackCurrentTime();
  const trackPlayingID = trackPlaying?.id ?? null;
  const formattedElapsed = useFormattedDuration(Math.max(0, currentTime));
  const formattedDurationValue = useFormattedDuration(duration);
  const [isWideLayout, setIsWideLayout] = useState(
    () => window.innerWidth >= 1180,
  );
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyrics, setLyrics] = useState<LocalLyrics | null>(null);
  const [lyricsLoadState, setLyricsLoadState] =
    useState<LyricsLoadState>('unavailable');
  const [isSelectingLyrics, setIsSelectingLyrics] = useState(false);
  const [isFollowingCurrentLine, setIsFollowingCurrentLine] = useState(true);
  const [artworkMode, setArtworkMode] = useState<'vinyl' | 'cover'>('vinyl');
  const [lyricsSettings, setLyricsSettings] =
    useState<FullscreenLyricsSettings>(getFullscreenLyricsSettings);
  const [lyricsSettingsOpen, setLyricsSettingsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const queueTriggerRef = useRef<HTMLButtonElement>(null);
  const queueCloseButtonRef = useRef<HTMLButtonElement>(null);
  const lyricsSettingsTriggerRef = useRef<HTMLButtonElement>(null);
  const lyricsSettingsPanelRef = useRef<HTMLElement>(null);
  const suppressNextLyricsSettingsTriggerFocusOpenRef = useRef(false);
  const lyricsScrollerRef = useRef<HTMLElement>(null);
  const currentLineRef = useRef<HTMLParagraphElement>(null);
  const isAutoScrollingRef = useRef(false);
  const lyricsRequestGenerationRef = useRef(0);
  const latestTrackPlayingIDRef = useRef(trackPlayingID);
  latestTrackPlayingIDRef.current = trackPlayingID;

  const applyLyricsResult = useCallback(
    (result: LyricsReadResult): LocalLyrics | null => {
      if (result.status === 'available') {
        const nextLyrics = parseLocalLyrics(result.text, result.source);
        setLyrics(nextLyrics);
        setLyricsLoadState('ready');
        setIsFollowingCurrentLine(true);
        return nextLyrics;
      }

      setLyrics(null);
      setIsFollowingCurrentLine(true);
      setLyricsLoadState(result.status === 'failed' ? 'failed' : 'unavailable');
      return null;
    },
    [],
  );

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    let wasWideLayout = window.innerWidth >= 1180;

    const syncLayout = () => {
      const nextIsWideLayout = window.innerWidth >= 1180;
      if (nextIsWideLayout === wasWideLayout) return;

      const previouslyWideLayout = wasWideLayout;
      wasWideLayout = nextIsWideLayout;
      setIsWideLayout(nextIsWideLayout);
      if (previouslyWideLayout && !nextIsWideLayout) {
        setQueueOpen(false);
      }
    };

    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  useEffect(() => {
    if (!queueOpen || isWideLayout) return;
    queueCloseButtonRef.current?.focus();
  }, [isWideLayout, queueOpen]);

  useEffect(() => {
    if (!lyricsSettingsOpen) return;

    const frame = window.requestAnimationFrame(() => {
      lyricsSettingsPanelRef.current
        ?.querySelector<HTMLButtonElement>('button:not([disabled])')
        ?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [lyricsSettingsOpen]);

  useEffect(() => {
    let cancelled = false;
    const requestGeneration = ++lyricsRequestGenerationRef.current;

    if (trackPlayingID === null) {
      setLyrics(null);
      setLyricsLoadState('unavailable');
      return;
    }

    setLyrics(null);
    setLyricsLoadState('loading');
    setIsFollowingCurrentLine(true);

    void LyricsBridge.getSiblingLyrics(trackPlayingID)
      .then((result) => {
        if (
          !cancelled &&
          lyricsRequestGenerationRef.current === requestGeneration &&
          latestTrackPlayingIDRef.current === trackPlayingID
        ) {
          applyLyricsResult(result);
        }
      })
      .catch(() => {
        if (
          !cancelled &&
          lyricsRequestGenerationRef.current === requestGeneration &&
          latestTrackPlayingIDRef.current === trackPlayingID
        ) {
          setLyrics(null);
          setLyricsLoadState('failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyLyricsResult, trackPlayingID]);

  const currentLineIndex = useMemo(() => {
    if (lyrics?.kind !== 'timed') return null;

    return findCurrentLyricLineIndex(lyrics.lines, currentTime);
  }, [currentTime, lyrics]);

  const scrollToCurrentLine = useCallback(() => {
    const scroller = lyricsScrollerRef.current;
    const currentLine = currentLineRef.current;
    if (scroller === null || currentLine === null) return;

    const targetTop = Math.max(
      0,
      currentLine.offsetTop -
        (scroller.clientHeight - currentLine.offsetHeight) / 2,
    );

    isAutoScrollingRef.current = true;
    scroller.scrollTo({ top: targetTop, behavior: 'auto' });
    window.requestAnimationFrame(() => {
      isAutoScrollingRef.current = false;
    });
  }, []);

  const seekToLyric = useCallback(
    (timeMs: number | null) => {
      if (timeMs === null) return;

      player.setCurrentTime(timeMs / 1_000);
      setIsFollowingCurrentLine(true);
      window.requestAnimationFrame(scrollToCurrentLine);
    },
    [scrollToCurrentLine],
  );

  const isTimedLyrics = lyrics?.kind === 'timed';
  const effectiveLyricsDisplayMode = isTimedLyrics
    ? lyricsSettings.displayMode
    : 'scroll';

  useEffect(() => {
    if (
      effectiveLyricsDisplayMode === 'scroll' &&
      isFollowingCurrentLine &&
      currentLineIndex !== null
    ) {
      scrollToCurrentLine();
    }
  }, [
    currentLineIndex,
    effectiveLyricsDisplayMode,
    isFollowingCurrentLine,
    scrollToCurrentLine,
  ]);

  const updateLyricsSettings = useCallback(
    (nextSettings: FullscreenLyricsSettings) => {
      setLyricsSettings(nextSettings);
      window.localStorage.setItem(
        FULLSCREEN_LYRICS_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings),
      );
    },
    [],
  );

  const chooseLyrics = useCallback(async () => {
    const trackIDAtSelectionStart = latestTrackPlayingIDRef.current;
    setIsSelectingLyrics(true);

    try {
      const result = await LyricsBridge.selectAndRead();
      if (
        result.status !== 'cancelled' &&
        latestTrackPlayingIDRef.current === trackIDAtSelectionStart
      ) {
        ++lyricsRequestGenerationRef.current;
        const nextLyrics = applyLyricsResult(result);
        if (
          result.status === 'available' &&
          trackIDAtSelectionStart !== null &&
          nextLyrics !== null
        ) {
          publishUserSelectedLyrics({
            trackId: trackIDAtSelectionStart,
            lyrics: nextLyrics,
          });
        }
      }
    } catch {
      if (latestTrackPlayingIDRef.current === trackIDAtSelectionStart) {
        ++lyricsRequestGenerationRef.current;
        setLyrics(null);
        setLyricsLoadState('failed');
      }
    } finally {
      setIsSelectingLyrics(false);
    }
  }, [applyLyricsResult]);

  const closeLyricsSettingsAndRestoreFocus = useCallback(() => {
    setLyricsSettingsOpen(false);
    suppressNextLyricsSettingsTriggerFocusOpenRef.current = true;
    window.requestAnimationFrame(() => {
      lyricsSettingsTriggerRef.current?.focus();
    });
  }, []);

  const handleLyricsSettingsOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) setQueueOpen(false);
    setLyricsSettingsOpen(isOpen);
  }, []);

  const toggleOverlayQueue = useCallback(() => {
    setLyricsSettingsOpen(false);
    setQueueOpen((isOpen) => !isOpen);
  }, []);

  const trapDialogFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();

      if (lyricsSettingsOpen) {
        closeLyricsSettingsAndRestoreFocus();
        return;
      }

      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

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

  const onLyricsScroll = () => {
    if (!isAutoScrollingRef.current) setIsFollowingCurrentLine(false);
  };

  const closeOverlayQueue = useCallback(() => {
    setQueueOpen(false);
    window.requestAnimationFrame(() => {
      queueTriggerRef.current?.focus();
    });
  }, []);

  const trapQueueDrawerFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeOverlayQueue();
      return;
    }

    if (event.key !== 'Tab') return;

    event.stopPropagation();
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

  const formattedDuration =
    duration === null ? '--:--' : formattedDurationValue;
  const displayedLyricsLines = useMemo(() => {
    if (
      lyricsLoadState !== 'ready' ||
      lyrics === null ||
      lyrics.kind === 'unavailable'
    ) {
      return null;
    }

    if (effectiveLyricsDisplayMode === 'single' && lyrics.kind === 'timed') {
      if (currentLineIndex === null) return [];

      const currentLine = lyrics.lines[currentLineIndex];
      return currentLine === undefined
        ? []
        : [{ index: currentLineIndex, line: currentLine }];
    }

    return lyrics.lines.map((line, index) => ({ index, line }));
  }, [currentLineIndex, effectiveLyricsDisplayMode, lyrics, lyricsLoadState]);
  const lyricsMessage =
    lyricsLoadState === 'loading'
      ? t`Loading lyrics...`
      : lyricsLoadState === 'failed'
        ? t`Lyrics could not be read`
        : lyrics?.kind === 'unavailable' &&
            lyrics.message === 'invalid-timestamp'
          ? t`Lyrics could not be parsed`
          : t`No lyrics available`;

  const queuePanel = (
    <OverlayQueueContent
      currentTrack={trackPlaying}
      isPaused={isPaused}
      queue={queue}
      queueCursor={queueCursor}
      onClose={closeOverlayQueue}
      closeButtonRef={isWideLayout ? undefined : queueCloseButtonRef}
    />
  );

  return (
    <section
      aria-label={t`Now playing`}
      aria-modal="true"
      data-lyrics-background={lyricsSettings.background}
      data-lyrics-display-mode={effectiveLyricsDisplayMode}
      data-reference-layout="moekoe-now-playing"
      data-testid="now-playing-overlay"
      role="dialog"
      onKeyDown={trapDialogFocus}
      {...stylex.props(styles.overlay)}
    >
      {trackPlaying !== null && (
        <NowPlayingBackdrop
          background={lyricsSettings.background}
          track={trackPlaying}
        />
      )}
      <div
        aria-hidden="true"
        {...stylex.props(
          styles.backdropVeil,
          lyricsSettings.background === 'off' && styles.backdropVeilOff,
        )}
      />
      <header {...stylex.props(styles.overlayHeader)}>
        <ButtonIcon
          ref={closeButtonRef}
          icon="chevronDown"
          iconSize={20}
          label={t`Close now playing`}
          onClick={onClose}
          xstyle={styles.closeButton}
        />
      </header>

      <div
        {...stylex.props(
          styles.content,
          queueOpen && isWideLayout && styles.contentWithQueue,
        )}
      >
        <section
          aria-label={t`Track details`}
          {...stylex.props(styles.trackPanel)}
        >
          {trackPlaying === null ? (
            <div role="status" {...stylex.props(styles.emptyTrack)}>
              {t`No track selected`}
            </div>
          ) : (
            <>
              <button
                aria-label={trackPlaying.title}
                data-testid="now-playing-artwork"
                title={trackPlaying.title}
                type="button"
                onClick={() =>
                  setArtworkMode((mode) =>
                    mode === 'vinyl' ? 'cover' : 'vinyl',
                  )
                }
                {...stylex.props(styles.artworkToggle)}
              >
                {artworkMode === 'vinyl' ? (
                  <div
                    data-playback-state={isPaused ? 'paused' : 'playing'}
                    data-testid="now-playing-vinyl"
                    {...stylex.props(styles.vinylPlayer)}
                  >
                    <div
                      aria-hidden="true"
                      {...stylex.props(
                        styles.vinylDisc,
                        !isPaused && styles.vinylDiscPlaying,
                      )}
                    >
                      <span {...stylex.props(styles.vinylGrooves)} />
                      <div {...stylex.props(styles.vinylCover)}>
                        <Cover track={trackPlaying} iconSize={36} />
                      </div>
                    </div>
                    <span
                      aria-hidden="true"
                      {...stylex.props(styles.tonearmBase)}
                    />
                    <span
                      aria-hidden="true"
                      {...stylex.props(
                        styles.tonearm,
                        !isPaused && styles.tonearmPlaying,
                      )}
                    >
                      <span {...stylex.props(styles.tonearmNeedle)} />
                    </span>
                  </div>
                ) : (
                  <div
                    data-testid="now-playing-cover"
                    {...stylex.props(styles.squareCover)}
                  >
                    <Cover track={trackPlaying} iconSize={36} />
                  </div>
                )}
              </button>
              <div {...stylex.props(styles.trackDetails)}>
                <h1
                  title={trackPlaying.title}
                  {...stylex.props(styles.trackTitle)}
                >
                  {trackPlaying.title}
                </h1>
                <span
                  title={trackPlaying.artists.join(', ')}
                  {...stylex.props(styles.trackArtists)}
                >
                  {trackPlaying.artists.join(', ')}
                </span>
                <span
                  title={trackPlaying.album}
                  {...stylex.props(styles.trackAlbum)}
                >
                  {trackPlaying.album}
                </span>
                {mediaError !== null && (
                  <span role="status" {...stylex.props(styles.mediaError)}>
                    {t`Media error`}
                  </span>
                )}
              </div>
              <footer {...stylex.props(styles.trackFooter)}>
                <div {...stylex.props(styles.progressRow)}>
                  <span {...stylex.props(styles.time)}>{formattedElapsed}</span>
                  <div {...stylex.props(styles.progress)}>
                    <TrackProgress trackPlaying={trackPlaying} />
                  </div>
                  <span {...stylex.props(styles.time)}>
                    {formattedDuration}
                  </span>
                </div>
                <div {...stylex.props(styles.controlRow)}>
                  <ButtonShuffle />
                  <PlayerControls />
                  <ButtonPlaybackMode />
                  <ButtonIcon
                    ref={queueTriggerRef}
                    aria-expanded={queueOpen}
                    icon="list"
                    iconSize={20}
                    label={queueOpen ? t`Close queue` : t`Open queue`}
                    onClick={toggleOverlayQueue}
                  />
                </div>
              </footer>
            </>
          )}
        </section>

        <section aria-label={t`Lyrics`} {...stylex.props(styles.lyricsPanel)}>
          <header {...stylex.props(styles.lyricsHeader)}>
            <div {...stylex.props(styles.lyricsActions)}>
              {currentLineIndex !== null && !isFollowingCurrentLine && (
                <ButtonIcon
                  icon="rotateCcw"
                  iconSize={16}
                  label={t`Return to current lyric`}
                  onClick={() => {
                    setIsFollowingCurrentLine(true);
                    window.requestAnimationFrame(scrollToCurrentLine);
                  }}
                />
              )}
              <FullscreenLyricsSettings
                isOpen={lyricsSettingsOpen}
                isTimedLyrics={isTimedLyrics}
                panelRef={lyricsSettingsPanelRef}
                settings={lyricsSettings}
                suppressNextTriggerFocusOpenRef={
                  suppressNextLyricsSettingsTriggerFocusOpenRef
                }
                triggerRef={lyricsSettingsTriggerRef}
                onOpenChange={handleLyricsSettingsOpenChange}
                onSettingsChange={updateLyricsSettings}
              />
              <ButtonIcon
                disabled={isSelectingLyrics}
                icon="fileText"
                iconSize={16}
                label={t`Choose lyrics file`}
                onClick={() => void chooseLyrics()}
              />
            </div>
          </header>
          <section
            ref={lyricsScrollerRef}
            aria-label={t`Lyrics`}
            data-testid="lyrics-scroll-region"
            onScroll={onLyricsScroll}
            {...stylex.props(
              styles.lyricsScroller,
              effectiveLyricsDisplayMode === 'single' &&
                styles.lyricsScrollerSingle,
            )}
          >
            {displayedLyricsLines !== null ? (
              displayedLyricsLines.length > 0 ? (
                displayedLyricsLines.map(({ index, line }) => {
                  const isCurrent = index === currentLineIndex;
                  const isSeekable =
                    lyrics?.kind === 'timed' && line.timeMs !== null;
                  return (
                    <p
                      key={`${line.timeMs ?? 'plain'}-${index}`}
                      ref={isCurrent ? currentLineRef : undefined}
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={
                        isSeekable ? () => seekToLyric(line.timeMs) : undefined
                      }
                      onKeyDown={
                        isSeekable
                          ? (event) => {
                              if (event.key !== 'Enter' && event.key !== ' ') {
                                return;
                              }

                              event.preventDefault();
                              seekToLyric(line.timeMs);
                            }
                          : undefined
                      }
                      role={isSeekable ? 'button' : undefined}
                      tabIndex={isSeekable ? 0 : undefined}
                      title={
                        isSeekable && line.timeMs !== null
                          ? formatLyricTimestamp(line.timeMs)
                          : undefined
                      }
                      {...stylex.props(
                        styles.lyricLine,
                        lyricsSettings.fontSize === '20px' &&
                          styles.lyricLineSmall,
                        lyricsSettings.fontSize === '24px' &&
                          styles.lyricLineMedium,
                        lyricsSettings.fontSize === '32px' &&
                          styles.lyricLineLarge,
                        lyricsSettings.align === 'left' && styles.lyricLineLeft,
                        effectiveLyricsDisplayMode === 'single' &&
                          styles.singleLyricLine,
                        isSeekable && styles.seekableLyricLine,
                        isCurrent && styles.currentLyricLine,
                        isCurrent &&
                          lyricsSettings.align === 'left' &&
                          styles.currentLyricLineLeft,
                      )}
                    >
                      {line.text}
                    </p>
                  );
                })
              ) : (
                <p role="status" {...stylex.props(styles.lyricsStatus)}>
                  {t`等待歌词开始`}
                </p>
              )
            ) : (
              <p role="status" {...stylex.props(styles.lyricsStatus)}>
                {lyricsMessage}
              </p>
            )}
          </section>
        </section>

        {queueOpen && isWideLayout && (
          <aside
            aria-label={t`Queue`}
            role="complementary"
            {...stylex.props(styles.queuePanel)}
          >
            {queuePanel}
          </aside>
        )}

        {queueOpen && !isWideLayout && (
          <aside
            aria-label={t`Queue`}
            aria-modal="true"
            role="dialog"
            onKeyDown={trapQueueDrawerFocus}
            {...stylex.props(styles.queueDrawer)}
          >
            {queuePanel}
          </aside>
        )}
      </div>
    </section>
  );
}

const vinylSpin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const styles = stylex.create({
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    minWidth: 0,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '72px minmax(0, 1fr)',
    isolation: 'isolate',
    overflow: 'hidden',
    backgroundColor: '#161616',
    color: '#f2f4f8',
  },
  backdrop: {
    position: 'absolute',
    inset: '-40px',
    zIndex: -2,
    backgroundColor: '#222222',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    filter: 'blur(24px)',
    opacity: 0.74,
    transform: 'scale(1.08)',
  },
  backdropCover: {
    filter: 'blur(8px)',
    opacity: 0.86,
  },
  backdropVeil: {
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    backgroundColor: 'rgba(22, 22, 22, 0.62)',
  },
  backdropVeilOff: {
    backgroundColor: '#161616',
  },
  overlayHeader: {
    minWidth: 0,
    paddingTop: '20px',
    paddingRight: {
      default: '45px',
      '@media (max-width: 899px)': '16px',
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: 0,
    color: 'rgba(255, 255, 255, 0.86)',
    backgroundColor: {
      ':hover': 'rgba(255, 255, 255, 0.1)',
      ':active': 'rgba(255, 255, 255, 0.16)',
    },
  },
  content: {
    position: 'relative',
    minWidth: 0,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(300px, 0.4fr) minmax(380px, 0.6fr)',
      '@media (max-width: 899px)': 'minmax(0, 1fr)',
    },
    gridTemplateRows: {
      '@media (max-width: 899px)': 'minmax(0, 1fr) auto',
    },
    overflow: 'hidden',
  },
  contentWithQueue: {
    gridTemplateColumns: {
      '@media (min-width: 1180px)':
        'minmax(300px, 0.36fr) minmax(380px, 0.58fr) 300px',
    },
  },
  trackPanel: {
    minWidth: 0,
    minHeight: 0,
    padding: {
      default: '20px 24px 32px 40px',
      '@media (max-width: 899px)': '0 20px 16px',
    },
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (max-width: 899px)': 'row',
    },
    alignItems: {
      default: 'center',
      '@media (max-width: 899px)': 'center',
    },
    justifyContent: 'center',
    rowGap: '20px',
    columnGap: '16px',
    borderRightWidth: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
    order: {
      '@media (max-width: 899px)': 2,
    },
  },
  artworkToggle: {
    width: {
      default: 'max(120px, min(400px, 33vw, calc(100vh - 330px)))',
      '@media (max-width: 899px)': 'min(34vw, 180px)',
    },
    display: {
      default: 'block',
      '@media (max-width: 767px)': 'none',
    },
    maxWidth: '100%',
    aspectRatio: '1',
    alignSelf: {
      default: 'center',
      '@media (max-width: 899px)': 'auto',
    },
    flexShrink: 0,
    overflow: 'visible',
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'transform 220ms ease-out',
    transform: {
      ':hover': 'scale(1.018)',
      ':active': 'scale(0.985)',
    },
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  vinylPlayer: {
    width: '112.5%',
    maxWidth: 'none',
    aspectRatio: '1',
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    overflow: 'visible',
    justifySelf: 'center',
  },
  squareCover: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: '10px',
    backgroundColor: 'var(--cover-bg)',
    boxShadow:
      '0 24px 56px rgba(0, 0, 0, 0.52), inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
  },
  vinylDisc: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: '999px',
    backgroundColor: '#090a0d',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 0 32px rgba(0, 0, 0, 0.92), 0 28px 70px rgba(0, 0, 0, 0.5)',
    transform: 'rotate(0deg)',
    willChange: 'transform',
  },
  vinylDiscPlaying: {
    animationName: {
      default: vinylSpin,
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    animationDuration: '5s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  vinylGrooves: {
    position: 'absolute',
    inset: '4%',
    borderRadius: '999px',
    backgroundImage:
      'repeating-radial-gradient(circle at center, rgba(255, 255, 255, 0.12) 0 1px, rgba(255, 255, 255, 0.02) 2px 4px, transparent 5px 8px)',
    opacity: 0.5,
  },
  vinylCover: {
    position: 'absolute',
    zIndex: 1,
    inset: '20%',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '999px',
    backgroundColor: 'var(--cover-bg)',
    boxShadow: '0 0 0 8px rgba(0, 0, 0, 0.24)',
  },
  tonearmBase: {
    position: 'absolute',
    zIndex: 3,
    top: '3%',
    right: '1%',
    width: '16%',
    aspectRatio: '1',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderColor: '#747474',
    borderRadius: '999px',
    backgroundColor: '#262626',
    boxShadow: '0 5px 12px rgba(0, 0, 0, 0.5)',
  },
  tonearm: {
    position: 'absolute',
    zIndex: 4,
    top: '9%',
    right: '6%',
    width: '8%',
    height: '60%',
    borderRadius: '999px',
    backgroundColor: '#c1c1c1',
    boxShadow:
      'inset -2px 0 0 rgba(0, 0, 0, 0.26), 2px 4px 8px rgba(0, 0, 0, 0.38)',
    transform: 'rotate(-30deg)',
    transformOrigin: '50% 7%',
    transitionProperty: 'transform',
    transitionDuration: {
      default: '560ms',
      '@media (prefers-reduced-motion: reduce)': '0ms',
    },
    transitionTimingFunction: 'cubic-bezier(0.2, 0.82, 0.25, 1)',
  },
  tonearmPlaying: {
    transform: 'rotate(0deg)',
  },
  tonearmNeedle: {
    position: 'absolute',
    bottom: '-5px',
    left: '50%',
    width: '18px',
    height: '17px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#a0a0a0',
    borderRadius: '3px',
    backgroundColor: '#292929',
    boxShadow: '0 3px 5px rgba(0, 0, 0, 0.5)',
    transform: 'translateX(-50%) rotate(12deg)',
  },
  trackDetails: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: {
      default: 'center',
      '@media (max-width: 899px)': 'flex-start',
    },
    rowGap: '5px',
    textAlign: {
      default: 'center',
      '@media (max-width: 899px)': 'left',
    },
  },
  trackTitle: {
    minWidth: 0,
    margin: 0,
    color: '#ffffff',
    fontSize: '22px',
    lineHeight: 1.25,
    fontWeight: 700,
    letterSpacing: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackArtists: {
    minWidth: 0,
    color: 'rgba(242, 244, 248, 0.86)',
    fontSize: '14px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackAlbum: {
    minWidth: 0,
    color: 'rgba(242, 244, 248, 0.62)',
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mediaError: {
    color: '#ff8c8c',
    fontSize: '12px',
  },
  emptyTrack: {
    width: '100%',
    color: 'rgba(242, 244, 248, 0.72)',
    textAlign: 'center',
  },
  trackFooter: {
    width: 'min(440px, 100%)',
    minWidth: 0,
    marginTop: '4px',
    display: 'grid',
    rowGap: '16px',
  },
  lyricsPanel: {
    minWidth: 0,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '48px minmax(0, 1fr)',
    backgroundColor: 'transparent',
    order: {
      '@media (max-width: 899px)': 1,
    },
  },
  lyricsHeader: {
    position: 'relative',
    minWidth: 0,
    paddingInline: {
      default: '24px',
      '@media (max-width: 899px)': '16px',
    },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: '12px',
    borderBottomWidth: 0,
  },
  lyricsActions: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '4px',
  },
  lyricsSettingsControl: {
    position: 'relative',
    display: 'inline-flex',
  },
  lyricsSettingsGuideAnchor: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '280px',
    height: '8px',
  },
  lyricsSettingsPanel: {
    width: 'min(280px, calc(100vw - 96px))',
    boxSizing: 'border-box',
    position: 'absolute',
    zIndex: 4,
    top: 'calc(100% + 4px)',
    right: 0,
    padding: '12px',
    display: 'grid',
    rowGap: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: '8px',
    color: '#ffffff',
    backgroundColor: 'rgba(17, 23, 31, 0.94)',
    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.34)',
    backdropFilter: 'blur(16px)',
  },
  lyricsSettingsHeading: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.92)',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1.4,
  },
  lyricsSettingsRow: {
    display: 'grid',
    rowGap: '5px',
  },
  lyricsSettingsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '12px',
    lineHeight: 1.35,
  },
  lyricsSettingsOptions: {
    display: 'grid',
    rowGap: '4px',
    columnGap: '4px',
    padding: '4px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  lyricsSettingsOptionsTwo: {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
  lyricsSettingsOptionsThree: {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  lyricsSettingsOption: {
    minWidth: 0,
    minHeight: '28px',
    overflow: 'hidden',
    paddingInline: '8px',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '4px',
    color: 'rgba(255, 255, 255, 0.82)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgba(255, 255, 255, 0.12)',
      ':active': 'rgba(255, 255, 255, 0.18)',
    },
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
    opacity: {
      ':disabled': 0.42,
    },
  },
  lyricsSettingsOptionSelected: {
    color: '#161616',
    backgroundColor: '#ffffff',
  },
  lyricsScroller: {
    minHeight: 0,
    overflowY: 'auto',
    padding: {
      default: '6% 10%',
      '@media (max-width: 899px)': '24px 20px',
    },
    WebkitMaskImage:
      'linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%)',
    maskImage:
      'linear-gradient(to bottom, transparent 0, #000 14%, #000 86%, transparent 100%)',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  lyricsScrollerSingle: {
    display: 'grid',
    placeItems: 'center',
    paddingBlock: '24px',
    paddingInline: '10%',
  },
  lyricLine: {
    minWidth: 0,
    margin: 0,
    paddingBlock: '8px',
    paddingInline: '10px',
    color: 'rgba(242, 244, 248, 0.54)',
    fontSize: {
      default: '24px',
      '@media (max-width: 899px)': '20px',
    },
    lineHeight: 1.8,
    borderRadius: '10px',
    textAlign: 'center',
    transition:
      'color 220ms ease-out, transform 280ms ease-out, filter 220ms ease-out',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
  },
  lyricLineSmall: {
    fontSize: '20px',
  },
  lyricLineMedium: {
    fontSize: '24px',
  },
  lyricLineLarge: {
    fontSize: '32px',
  },
  lyricLineLeft: {
    textAlign: 'left',
  },
  singleLyricLine: {
    width: 'min(760px, 100%)',
    paddingBlock: '12px',
  },
  seekableLyricLine: {
    cursor: 'pointer',
    backgroundColor: {
      ':hover': 'rgba(255, 255, 255, 0.08)',
      ':active': 'rgba(255, 255, 255, 0.14)',
    },
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  currentLyricLine: {
    color: 'var(--main-color)',
    fontWeight: 750,
    backgroundColor: 'transparent',
    transform: 'scale(1.22)',
    filter: 'drop-shadow(0 10px 20px rgba(255, 255, 255, 0.16))',
  },
  currentLyricLineLeft: {
    transformOrigin: 'left center',
  },
  lyricsStatus: {
    margin: 0,
    paddingTop: '32px',
    color: 'rgba(242, 244, 248, 0.62)',
    textAlign: 'center',
  },
  queuePanel: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(17, 23, 31, 0.76)',
    backdropFilter: 'blur(12px)',
  },
  queueDrawer: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(17, 23, 31, 0.94)',
    boxShadow: 'var(--shadow-panel)',
  },
  queueHeader: {
    minHeight: '56px',
    paddingInline: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  queueHeading: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: '8px',
  },
  queueTitle: {
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 700,
  },
  queueCount: {
    color: 'rgba(242, 244, 248, 0.62)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
  },
  queueNowPlaying: {
    margin: '12px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'color-mix(in srgb, var(--main-color) 20%, transparent)',
  },
  queueCover: {
    width: '40px',
    height: '40px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
  },
  queueTrackInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
  },
  queueStatus: {
    color: 'var(--main-color)',
    fontSize: '11px',
    fontWeight: 700,
  },
  queueTrackTitle: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  queueTrackMeta: {
    minWidth: 0,
    color: 'rgba(242, 244, 248, 0.64)',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressRow: {
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: '44px minmax(0, 1fr) 44px',
    alignItems: 'center',
    columnGap: '10px',
  },
  time: {
    color: 'rgba(242, 244, 248, 0.66)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'center',
  },
  progress: {
    minWidth: 0,
  },
  controlRow: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    rowGap: '6px',
    columnGap: '8px',
  },
});
