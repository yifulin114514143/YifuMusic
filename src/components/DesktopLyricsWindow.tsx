import * as stylex from '@stylexjs/stylex';
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import DesktopLyricsBridge, {
  type DesktopLyricsWindowGeometry,
} from '../lib/bridge-desktop-lyrics';
import {
  EMPTY_DESKTOP_LYRICS_PAYLOAD,
  getDesktopLyricsDisplay,
  type DesktopLyricsPayload,
} from '../lib/desktop-lyrics';

type DesktopLyricsPreferences = {
  defaultColor: string;
  highlightColor: string;
  fontSize: number;
  isAlwaysOnTop: boolean;
  isLocked: boolean;
  isMousePassthrough: boolean;
};

export type DesktopLyricsResizeDirection =
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'nw';

export type DesktopLyricsResizeState = {
  direction: DesktopLyricsResizeDirection;
  geometry: DesktopLyricsWindowGeometry;
  startClientX: number;
  startClientY: number;
};

const PREFERENCES_STORAGE_KEY = 'desktop-lyrics-preferences';
const DEFAULT_PREFERENCES: DesktopLyricsPreferences = {
  defaultColor: '#d4d4d4',
  highlightColor: '#ea33e4',
  fontSize: 32,
  isAlwaysOnTop: true,
  isLocked: false,
  isMousePassthrough: false,
};
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 72;
export const RESIZE_EDGE_SIZE = 8;
export const MIN_DESKTOP_LYRICS_WIDTH = 800;
export const MIN_DESKTOP_LYRICS_HEIGHT = 128;

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value);
}

function getPreferences(): DesktopLyricsPreferences {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}',
    ) as Record<string, unknown>;

    return {
      defaultColor: isHexColor(saved.defaultColor)
        ? saved.defaultColor
        : DEFAULT_PREFERENCES.defaultColor,
      highlightColor: isHexColor(saved.highlightColor)
        ? saved.highlightColor
        : DEFAULT_PREFERENCES.highlightColor,
      fontSize:
        typeof saved.fontSize === 'number' &&
        Number.isFinite(saved.fontSize) &&
        saved.fontSize >= MIN_FONT_SIZE &&
        saved.fontSize <= MAX_FONT_SIZE
          ? saved.fontSize
          : DEFAULT_PREFERENCES.fontSize,
      isAlwaysOnTop:
        typeof saved.isAlwaysOnTop === 'boolean'
          ? saved.isAlwaysOnTop
          : DEFAULT_PREFERENCES.isAlwaysOnTop,
      isLocked:
        typeof saved.isLocked === 'boolean'
          ? saved.isLocked
          : DEFAULT_PREFERENCES.isLocked,
      isMousePassthrough:
        typeof saved.isMousePassthrough === 'boolean'
          ? saved.isMousePassthrough
          : DEFAULT_PREFERENCES.isMousePassthrough,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function gradientTextStyle(color: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${color} 100%)`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };
}

export function getResizeDirection(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): DesktopLyricsResizeDirection | null {
  const left = clientX <= RESIZE_EDGE_SIZE;
  const right = clientX >= width - RESIZE_EDGE_SIZE;
  const top = clientY <= RESIZE_EDGE_SIZE;
  const bottom = clientY >= height - RESIZE_EDGE_SIZE;

  if (top && left) return 'nw';
  if (top && right) return 'ne';
  if (bottom && left) return 'sw';
  if (bottom && right) return 'se';
  if (left) return 'w';
  if (right) return 'e';
  if (top) return 'n';
  if (bottom) return 's';
  return null;
}

export function getResizeCursor(
  direction: DesktopLyricsResizeDirection | null,
): CSSProperties['cursor'] {
  if (direction === 'n' || direction === 's') return 'ns-resize';
  if (direction === 'e' || direction === 'w') return 'ew-resize';
  if (direction === 'nw' || direction === 'se') return 'nwse-resize';
  if (direction === 'ne' || direction === 'sw') return 'nesw-resize';
  return undefined;
}

export function getResizedGeometry(
  resizeState: DesktopLyricsResizeState,
  clientX: number,
  clientY: number,
): DesktopLyricsWindowGeometry {
  const { direction, geometry, startClientX, startClientY } = resizeState;
  const deltaX = (clientX - startClientX) * geometry.scaleFactor;
  const deltaY = (clientY - startClientY) * geometry.scaleFactor;
  const minWidth = Math.ceil(MIN_DESKTOP_LYRICS_WIDTH * geometry.scaleFactor);
  const minHeight = Math.ceil(MIN_DESKTOP_LYRICS_HEIGHT * geometry.scaleFactor);
  let { x, y, width, height } = geometry;

  if (direction.includes('e')) {
    width = Math.max(minWidth, geometry.width + deltaX);
  }
  if (direction.includes('s')) {
    height = Math.max(minHeight, geometry.height + deltaY);
  }
  if (direction.includes('w')) {
    width = Math.max(minWidth, geometry.width - deltaX);
    x = geometry.x + geometry.width - width;
  }
  if (direction.includes('n')) {
    height = Math.max(minHeight, geometry.height - deltaY);
    y = geometry.y + geometry.height - height;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    scaleFactor: geometry.scaleFactor,
  };
}

export default function DesktopLyricsWindow() {
  const [payload, setPayload] = useState<DesktopLyricsPayload>(
    EMPTY_DESKTOP_LYRICS_PAYLOAD,
  );
  const [preferences, setPreferences] =
    useState<DesktopLyricsPreferences>(getPreferences);
  const [hoveredResizeDirection, setHoveredResizeDirection] =
    useState<DesktopLyricsResizeDirection | null>(null);
  const [resizeState, setResizeState] =
    useState<DesktopLyricsResizeState | null>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const interactionIDRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pendingGeometryRef = useRef<DesktopLyricsWindowGeometry | null>(null);
  const geometryUpdateInFlightRef = useRef(false);
  const geometryUpdateFrameRef = useRef<number | null>(null);

  const queueWindowGeometryUpdate = useCallback(
    (geometry: DesktopLyricsWindowGeometry) => {
      pendingGeometryRef.current = geometry;
      if (geometryUpdateFrameRef.current !== null) return;

      geometryUpdateFrameRef.current = window.requestAnimationFrame(() => {
        geometryUpdateFrameRef.current = null;
        if (geometryUpdateInFlightRef.current) return;

        const nextGeometry = pendingGeometryRef.current;
        pendingGeometryRef.current = null;
        if (nextGeometry === null) return;

        geometryUpdateInFlightRef.current = true;
        void DesktopLyricsBridge.updateWindowGeometry(nextGeometry)
          .catch(() => undefined)
          .finally(() => {
            geometryUpdateInFlightRef.current = false;
            if (pendingGeometryRef.current !== null) {
              queueWindowGeometryUpdate(pendingGeometryRef.current);
            }
          });
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (geometryUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(geometryUpdateFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void DesktopLyricsBridge.getState()
      .then((nextPayload) => {
        if (!disposed) setPayload(nextPayload);
      })
      .catch(() => undefined);

    void DesktopLyricsBridge.listenForState((nextPayload) => {
      setPayload(nextPayload);
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

  const clearResizeState = useCallback(() => {
    setResizeState(null);
    setHoveredResizeDirection(null);
  }, []);

  const stopNativeDragging = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      if (resizeState !== null || isDraggingRef.current) {
        clearResizeState();
        stopNativeDragging();
        return;
      }
      void DesktopLyricsBridge.close();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [clearResizeState, resizeState, stopNativeDragging]);

  useEffect(() => stopNativeDragging, [stopNativeDragging]);

  useEffect(() => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  }, [preferences]);

  useEffect(() => {
    void DesktopLyricsBridge.setAlwaysOnTop(preferences.isAlwaysOnTop).catch(
      () => undefined,
    );
  }, [preferences.isAlwaysOnTop]);

  useEffect(() => {
    void DesktopLyricsBridge.setResizable(!preferences.isLocked).catch(
      () => undefined,
    );
  }, [preferences.isLocked]);

  const syncMousePassthrough = useCallback(() => {
    const controls = controlsRef.current;
    if (controls === null) {
      void DesktopLyricsBridge.setMousePassthrough(false, null).catch(
        () => undefined,
      );
      return;
    }

    const bounds = controls.getBoundingClientRect();
    void DesktopLyricsBridge.setMousePassthrough(
      preferences.isMousePassthrough,
      {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        devicePixelRatio: window.devicePixelRatio,
      },
    ).catch(() => undefined);
  }, [preferences.isMousePassthrough]);

  useEffect(() => {
    syncMousePassthrough();

    const controls = controlsRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (controls !== null && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncMousePassthrough);
      resizeObserver.observe(controls);
    }
    window.addEventListener('resize', syncMousePassthrough);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncMousePassthrough);
      void DesktopLyricsBridge.setMousePassthrough(false, null).catch(
        () => undefined,
      );
    };
  }, [syncMousePassthrough]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (resizeState === null) return;
      queueWindowGeometryUpdate(
        getResizedGeometry(resizeState, event.clientX, event.clientY),
      );
    };
    const onMouseUp = () => {
      interactionIDRef.current += 1;
      clearResizeState();
      stopNativeDragging();
    };
    const onWindowBlur = () => {
      interactionIDRef.current += 1;
      clearResizeState();
      stopNativeDragging();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [
    clearResizeState,
    queueWindowGeometryUpdate,
    resizeState,
    stopNativeDragging,
  ]);

  const display = useMemo(() => getDesktopLyricsDisplay(payload), [payload]);
  const currentLine = display.currentLine?.text ?? 'YifuMusic - 聆听此刻';
  const nextLine = display.nextLine?.text ?? '';
  const currentLineIsTimed = payload.lyricsKind === 'timed';
  const currentTextStyle = {
    ...gradientTextStyle(preferences.defaultColor),
    fontSize: `${preferences.fontSize}px`,
  };
  const highlightTextStyle = {
    ...gradientTextStyle(preferences.highlightColor),
    width: `${Math.round(display.highlightProgress * 100)}%`,
    fontSize: `${preferences.fontSize}px`,
  };
  const nextTextStyle = {
    ...gradientTextStyle(preferences.defaultColor),
    fontSize: `${Math.max(MIN_FONT_SIZE, preferences.fontSize - 6)}px`,
  };

  const sendControl = (action: 'previous' | 'play-pause' | 'next') => {
    void DesktopLyricsBridge.sendControl(action).catch(() => undefined);
  };

  const onMouseMove = (event: ReactMouseEvent<HTMLElement>) => {
    if (
      preferences.isLocked ||
      preferences.isMousePassthrough ||
      resizeState !== null
    ) {
      setHoveredResizeDirection(null);
      return;
    }
    setHoveredResizeDirection(
      getResizeDirection(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      ),
    );
  };

  const onMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    if (
      preferences.isLocked ||
      preferences.isMousePassthrough ||
      event.button !== 0
    ) {
      return;
    }

    const resizeDirection = getResizeDirection(
      event.clientX,
      event.clientY,
      window.innerWidth,
      window.innerHeight,
    );
    if (resizeDirection !== null) {
      event.preventDefault();
      event.stopPropagation();
      const interactionID = ++interactionIDRef.current;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      void DesktopLyricsBridge.getWindowGeometry()
        .then((geometry) => {
          if (interactionID !== interactionIDRef.current) return;
          setResizeState({
            direction: resizeDirection,
            geometry,
            startClientX,
            startClientY,
          });
          setHoveredResizeDirection(resizeDirection);
        })
        .catch(() => undefined);
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, input, label')) return;

    event.preventDefault();
    isDraggingRef.current = true;
    void DesktopLyricsBridge.startDragging().catch(() => {
      isDraggingRef.current = false;
    });
  };

  const activeResizeDirection =
    resizeState?.direction ?? hoveredResizeDirection;

  return (
    <main
      aria-label="桌面歌词"
      data-locked={preferences.isLocked}
      data-mouse-passthrough={preferences.isMousePassthrough}
      data-resize-direction={activeResizeDirection ?? ''}
      onMouseDown={onMouseDown}
      onMouseLeave={() => {
        if (resizeState === null) setHoveredResizeDirection(null);
      }}
      onMouseMove={onMouseMove}
      style={{ cursor: getResizeCursor(activeResizeDirection) }}
      {...stylex.props(styles.window)}
    >
      <section
        ref={controlsRef}
        aria-label="桌面歌词控制栏"
        {...stylex.props(
          styles.controls,
          preferences.isLocked && styles.controlsLocked,
        )}
      >
        <ButtonIcon
          icon="pin"
          iconSize={16}
          isActive={preferences.isAlwaysOnTop}
          label={preferences.isAlwaysOnTop ? '关闭始终置顶' : '开启始终置顶'}
          aria-pressed={preferences.isAlwaysOnTop}
          onClick={() =>
            setPreferences((current) => ({
              ...current,
              isAlwaysOnTop: !current.isAlwaysOnTop,
            }))
          }
        />
        <ButtonIcon
          icon="mousePointer"
          iconSize={16}
          isActive={preferences.isMousePassthrough}
          label={
            preferences.isMousePassthrough ? '关闭鼠标穿透' : '开启鼠标穿透'
          }
          aria-pressed={preferences.isMousePassthrough}
          onClick={() =>
            setPreferences((current) => ({
              ...current,
              isMousePassthrough: !current.isMousePassthrough,
            }))
          }
        />
        {preferences.isLocked ? (
          <ButtonIcon
            icon="lock"
            iconSize={16}
            label="解锁桌面歌词布局"
            onClick={() =>
              setPreferences((current) => ({ ...current, isLocked: false }))
            }
          />
        ) : (
          <>
            <label title="默认歌词颜色" {...stylex.props(styles.colorControl)}>
              <span {...stylex.props(styles.srOnly)}>默认歌词颜色</span>
              <input
                aria-label="默认歌词颜色"
                type="color"
                value={preferences.defaultColor}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultColor: event.target.value,
                  }))
                }
                {...stylex.props(styles.colorInput)}
              />
            </label>
            <label title="高亮歌词颜色" {...stylex.props(styles.colorControl)}>
              <span {...stylex.props(styles.srOnly)}>高亮歌词颜色</span>
              <input
                aria-label="高亮歌词颜色"
                type="color"
                value={preferences.highlightColor}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    highlightColor: event.target.value,
                  }))
                }
                {...stylex.props(styles.colorInput)}
              />
            </label>
            <button
              aria-label="减小歌词字号"
              title="减小歌词字号"
              type="button"
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  fontSize: Math.max(MIN_FONT_SIZE, current.fontSize - 2),
                }))
              }
              {...stylex.props(styles.textButton)}
            >
              A-
            </button>
            <ButtonIcon
              icon="skipBack"
              iconSize={16}
              label="上一首"
              onClick={() => sendControl('previous')}
            />
            <ButtonIcon
              icon={payload.isPaused ? 'play' : 'pause'}
              iconSize={16}
              label={payload.isPaused ? '播放' : '暂停'}
              onClick={() => sendControl('play-pause')}
            />
            <ButtonIcon
              icon="skipForward"
              iconSize={16}
              label="下一首"
              onClick={() => sendControl('next')}
            />
            <button
              aria-label="增大歌词字号"
              title="增大歌词字号"
              type="button"
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  fontSize: Math.min(MAX_FONT_SIZE, current.fontSize + 2),
                }))
              }
              {...stylex.props(styles.textButton)}
            >
              A+
            </button>
            <ButtonIcon
              icon="lock"
              iconSize={16}
              label="锁定桌面歌词布局"
              onClick={() =>
                setPreferences((current) => ({ ...current, isLocked: true }))
              }
            />
          </>
        )}
        <ButtonIcon
          icon="close"
          iconSize={16}
          label="关闭桌面歌词"
          onClick={() => void DesktopLyricsBridge.close()}
        />
      </section>

      <section
        aria-label="桌面歌词内容"
        aria-live="polite"
        {...stylex.props(styles.lyricsArea)}
      >
        {payload.title !== '' && (
          <p {...stylex.props(styles.trackMeta)}>
            {payload.title}
            {payload.artists.length > 0 && ` - ${payload.artists.join('、')}`}
          </p>
        )}
        <div {...stylex.props(styles.lyricLine)}>
          <span style={currentTextStyle} {...stylex.props(styles.lyricText)}>
            {currentLine}
          </span>
          {currentLineIsTimed && (
            <span
              aria-hidden="true"
              style={highlightTextStyle}
              {...stylex.props(styles.lyricHighlight)}
            >
              {currentLine}
            </span>
          )}
        </div>
        {nextLine !== '' && (
          <div {...stylex.props(styles.nextLine)}>
            <span style={nextTextStyle} {...stylex.props(styles.lyricText)}>
              {nextLine}
            </span>
          </div>
        )}
      </section>
    </main>
  );
}

const styles = stylex.create({
  window: {
    width: '100%',
    minHeight: '100vh',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    boxSizing: 'border-box',
    backgroundColor: 'transparent',
    color: '#ffffff',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
    userSelect: 'none',
    outline: 'none',
  },
  controls: {
    position: 'absolute',
    zIndex: 1,
    top: '8px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    rowGap: '4px',
    columnGap: '4px',
    padding: '4px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    opacity: {
      default: 0.18,
      ':hover': 1,
      ':focus-within': 1,
    },
    transition: 'opacity 120ms ease-out',
  },
  controlsLocked: {
    opacity: {
      default: 0,
      ':hover': 1,
      ':focus-within': 1,
    },
  },
  colorControl: {
    display: 'inline-flex',
    width: '28px',
    height: '28px',
  },
  colorInput: {
    width: '28px',
    height: '28px',
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
  textButton: {
    minWidth: '32px',
    minHeight: '32px',
    paddingBlock: '4px',
    paddingInline: '6px',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '6px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'rgba(255, 255, 255, 0.16)',
      ':active': 'rgba(255, 255, 255, 0.24)',
    },
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  lyricsArea: {
    width: '100%',
    minWidth: 0,
    paddingTop: '48px',
    paddingRight: '40px',
    paddingBottom: '24px',
    paddingLeft: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '8px',
    columnGap: '8px',
    boxSizing: 'border-box',
  },
  trackMeta: {
    maxWidth: '100%',
    margin: 0,
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: '12px',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  lyricLine: {
    position: 'relative',
    maxWidth: '100%',
    overflow: 'hidden',
    lineHeight: 1.25,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  lyricText: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
  },
  lyricHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.48)',
  },
  nextLine: {
    maxWidth: '100%',
    lineHeight: 1.25,
    opacity: 0.76,
    textAlign: 'center',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
    borderStyle: 'none',
  },
});
