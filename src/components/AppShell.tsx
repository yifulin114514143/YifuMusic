import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { I18N_CHANGE_EVENT } from '../lib/i18n';
import { configQuery } from '../lib/queries';
import { AppShellContext } from './AppShellContext';
import ConnectionStatus, { useConnectionStatus } from './ConnectionStatus';
import Header from './Header';
import Navigation from './Navigation';
import NowPlayingOverlay from './NowPlayingOverlay';
import PageHeader from './PageHeader';
import QueuePanel from './QueuePanel';

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  const { t } = useLingui();
  const language = useSuspenseQuery(configQuery).data.language;
  const location = useLocation();
  const navigate = useNavigate();
  const search = useSearch({ from: '__root__' });
  const [i18nRevision, setI18nRevision] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [navigationMode, setNavigationMode] = useState<'side' | 'top'>(() =>
    window.localStorage.getItem('yifu-navigation-mode') === 'side'
      ? 'side'
      : 'top',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem('sidebarCollapsed') === '1',
  );
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => window.innerWidth <= 767,
  );
  const [shouldFocusQueue, setShouldFocusQueue] = useState(false);
  const isOnline = useConnectionStatus();
  const queueTriggerRef = useRef<HTMLElement | null>(null);
  const nowPlayingTriggerRef = useRef<HTMLElement | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const nowPlayingOpen = search.now_playing === true;
  const effectiveSidebarCollapsed = sidebarCollapsed || isNarrowViewport;

  const getMainContentElement = useCallback(() => mainContentRef.current, []);

  const scrollMainContentToTop = useCallback(() => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openQueue = useCallback((trigger: HTMLElement | null) => {
    if (trigger !== null) queueTriggerRef.current = trigger;
    setShouldFocusQueue(true);
    setQueueOpen(true);
  }, []);

  const registerQueueTrigger = useCallback((trigger: HTMLElement | null) => {
    if (trigger !== null) queueTriggerRef.current = trigger;
  }, []);

  const closeQueue = useCallback(() => {
    setQueueOpen(false);
    setShouldFocusQueue(false);

    window.requestAnimationFrame(() => {
      queueTriggerRef.current?.focus();
    });
  }, []);

  const toggleQueue = useCallback(
    (trigger: HTMLElement | null) => {
      if (queueOpen) {
        closeQueue();
        return;
      }

      openQueue(trigger);
    },
    [closeQueue, openQueue, queueOpen],
  );

  const openNowPlaying = useCallback(
    (trigger: HTMLElement | null) => {
      if (trigger !== null) nowPlayingTriggerRef.current = trigger;
      void navigate({
        to: '.',
        search: (previous) => ({ ...previous, now_playing: true }),
      });
    },
    [navigate],
  );

  const closeNowPlaying = useCallback(() => {
    void navigate({
      to: '.',
      replace: true,
      search: (previous) => ({ ...previous, now_playing: undefined }),
    });

    window.requestAnimationFrame(() => {
      nowPlayingTriggerRef.current?.focus();
    });
  }, [navigate]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((previous) => {
      const next = !previous;

      window.localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  const toggleNavigationMode = useCallback(() => {
    setNavigationMode((previous) => {
      const next = previous === 'top' ? 'side' : 'top';

      window.localStorage.setItem('yifu-navigation-mode', next);
      setQueueOpen(false);
      setShouldFocusQueue(false);
      return next;
    });
  }, []);

  useEffect(() => {
    const refreshTranslations = () =>
      setI18nRevision((revision) => revision + 1);

    window.addEventListener(I18N_CHANGE_EVENT, refreshTranslations);
    return () =>
      window.removeEventListener(I18N_CHANGE_EVENT, refreshTranslations);
  }, []);

  useEffect(() => {
    const mainContent = mainContentRef.current;
    if (mainContent === null) return;

    const key = `app-shell-scroll:${location.href}`;
    const storedPosition = Number(window.sessionStorage.getItem(key) ?? '0');
    const position = Number.isFinite(storedPosition)
      ? Math.max(0, storedPosition)
      : 0;
    const frame = window.requestAnimationFrame(() => {
      mainContent.scrollTop = position;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.sessionStorage.setItem(key, String(mainContent.scrollTop));
    };
  }, [location.href]);

  useEffect(() => {
    let isWideLayout = window.innerWidth >= 1180;

    const syncQueueWithViewport = () => {
      const nextIsWideLayout = window.innerWidth >= 1180;
      setIsNarrowViewport(window.innerWidth <= 767);

      if (nextIsWideLayout === isWideLayout) return;

      const wasWideLayout = isWideLayout;
      isWideLayout = nextIsWideLayout;

      if (wasWideLayout && !nextIsWideLayout) {
        setQueueOpen(false);
      }
      setShouldFocusQueue(false);
    };

    window.addEventListener('resize', syncQueueWithViewport);
    return () => {
      window.removeEventListener('resize', syncQueueWithViewport);
    };
  }, []);

  return (
    <AppShellContext.Provider
      value={{
        queueOpen,
        shouldFocusQueue,
        nowPlayingOpen,
        navigationMode,
        sidebarCollapsed: effectiveSidebarCollapsed,
        toggleNavigationMode,
        toggleSidebar,
        registerQueueTrigger,
        getMainContentElement,
        scrollMainContentToTop,
        openQueue,
        closeQueue,
        toggleQueue,
        openNowPlaying,
        closeNowPlaying,
      }}
    >
      <div
        data-reference-layout="moekoe"
        data-navigation-mode={navigationMode}
        lang={language}
        {...stylex.props(styles.shell)}
      >
        <div
          data-testid="app-shell-workspace"
          {...stylex.props(
            styles.workspace,
            navigationMode === 'side' && styles.workspaceWithSidebar,
            navigationMode === 'side' &&
              !effectiveSidebarCollapsed &&
              styles.workspaceWithExpandedSidebar,
          )}
        >
          {navigationMode === 'side' && <Navigation />}
          <section {...stylex.props(styles.contentColumn)}>
            <PageHeader />
            <main
              ref={mainContentRef}
              aria-label={t`Main content`}
              data-testid="app-shell-main-content"
              {...stylex.props(
                styles.mainContent,
                navigationMode === 'side'
                  ? styles.mainContentSide
                  : styles.mainContentTop,
                !isOnline &&
                  (navigationMode === 'side'
                    ? styles.mainContentSideOffline
                    : styles.mainContentTopOffline),
              )}
            >
              <div
                key={location.href}
                data-route-transition="enter"
                {...stylex.props(
                  styles.mainContentShell,
                  navigationMode === 'top' && styles.mainContentShellTop,
                )}
              >
                {children}
              </div>
            </main>
          </section>
          <QueuePanel />
        </div>
        <ConnectionStatus
          isOnline={isOnline}
          navigationMode={navigationMode}
          sidebarCollapsed={effectiveSidebarCollapsed}
        />
        <Header key={i18nRevision} />
        {nowPlayingOpen && <NowPlayingOverlay onClose={closeNowPlaying} />}
      </div>
    </AppShellContext.Provider>
  );
}

const styles = stylex.create({
  shell: {
    minHeight: '100dvh',
    backgroundColor: 'var(--surface-canvas)',
    color: 'var(--text-primary)',
  },
  workspace: {
    height: '100dvh',
    minHeight: 0,
    overflow: 'hidden',
  },
  workspaceWithSidebar: {
    display: 'grid',
    gridTemplateColumns: {
      default: '67px minmax(0, 1fr)',
      '@media (max-width: 767px)': '64px minmax(0, 1fr)',
    },
  },
  workspaceWithExpandedSidebar: {
    gridTemplateColumns: {
      default: '226px minmax(0, 1fr)',
    },
  },
  contentColumn: {
    height: '100dvh',
    minWidth: 0,
    minHeight: 0,
    position: 'relative',
    backgroundColor: 'var(--surface-canvas)',
  },
  mainContent: {
    minWidth: 0,
    minHeight: 0,
    height: '100dvh',
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    paddingBottom: '150px',
  },
  mainContentTop: {
    paddingTop: '80px',
  },
  mainContentSide: {
    paddingTop: '52px',
  },
  mainContentTopOffline: {
    paddingTop: '102px',
  },
  mainContentSideOffline: {
    paddingTop: '90px',
  },
  mainContentShell: {
    width: '100%',
    minHeight: '100%',
    boxSizing: 'border-box',
    marginInline: 'auto',
    paddingInline: {
      default: '24px',
      '@media (max-width: 767px)': '16px',
    },
  },
  mainContentShellTop: {
    maxWidth: '1200px',
  },
});
