import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { I18N_CHANGE_EVENT } from '../lib/i18n';
import { configQuery } from '../lib/queries';
import { AppShellContext } from './AppShellContext';
import Header from './Header';
import Navigation from './Navigation';
import PageHeader from './PageHeader';
import QueuePanel from './QueuePanel';

type Props = {
  children: React.ReactNode;
};

export default function AppShell({ children }: Props) {
  const { t } = useLingui();
  const language = useSuspenseQuery(configQuery).data.language;
  const [i18nRevision, setI18nRevision] = useState(0);
  const [queueOpen, setQueueOpen] = useState(() => window.innerWidth >= 1180);
  const [shouldFocusQueue, setShouldFocusQueue] = useState(false);
  const queueTriggerRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const refreshTranslations = () =>
      setI18nRevision((revision) => revision + 1);

    window.addEventListener(I18N_CHANGE_EVENT, refreshTranslations);
    return () =>
      window.removeEventListener(I18N_CHANGE_EVENT, refreshTranslations);
  }, []);

  useEffect(() => {
    let isWideLayout = window.innerWidth >= 1180;

    const syncQueueWithViewport = () => {
      const nextIsWideLayout = window.innerWidth >= 1180;

      if (nextIsWideLayout === isWideLayout) return;

      isWideLayout = nextIsWideLayout;
      setQueueOpen(nextIsWideLayout);
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
        registerQueueTrigger,
        openQueue,
        closeQueue,
        toggleQueue,
      }}
    >
      <div lang={language} {...stylex.props(styles.shell)}>
        <div
          data-testid="app-shell-workspace"
          {...stylex.props(
            styles.workspace,
            queueOpen && styles.workspaceWithQueue,
          )}
        >
          <Navigation />
          <section {...stylex.props(styles.contentColumn)}>
            <PageHeader />
            <main
              aria-label={t`Main content`}
              {...stylex.props(styles.mainContent)}
            >
              {children}
            </main>
          </section>
          <QueuePanel />
        </div>
        <Header key={i18nRevision} />
      </div>
    </AppShellContext.Provider>
  );
}

const styles = stylex.create({
  shell: {
    height: '100dvh',
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'minmax(0, 1fr) 84px',
    backgroundColor: 'var(--surface-canvas)',
    color: 'var(--text-primary)',
  },
  workspace: {
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: {
      default: '224px minmax(0, 1fr)',
      '@media (max-width: 899px)': '64px minmax(0, 1fr)',
    },
    overflow: 'hidden',
  },
  workspaceWithQueue: {
    gridTemplateColumns: {
      default: '224px minmax(0, 1fr)',
      '@media (min-width: 1180px)': '224px minmax(0, 1fr) 320px',
    },
  },
  contentColumn: {
    minWidth: 0,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr)',
    backgroundColor: 'var(--surface-canvas)',
  },
  mainContent: {
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
  },
});
