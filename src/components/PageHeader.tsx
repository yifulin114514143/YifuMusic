import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import {
  Link,
  useCanGoBack,
  useLocation,
  useRouter,
} from '@tanstack/react-router';
import type { LinkProps } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { useAppShell } from './AppShellContext';
import ProfileMenu from './ProfileMenu';
import Search from './Search';

type PageMeta = {
  title: string;
  showSearch: boolean;
};

type TopNavItemProps = {
  to: LinkProps['to'];
  label: string;
};

function TopNavItem({ to, label }: TopNavItemProps) {
  return (
    <Link
      aria-label={label}
      title={label}
      to={to}
      draggable={false}
      data-museeks-action
      {...stylex.props(styles.topNavLink)}
    >
      {label}
    </Link>
  );
}

export default function PageHeader() {
  const location = useLocation();
  const { pathname } = location;
  const { t } = useLingui();
  const router = useRouter();
  const { navigationMode, sidebarCollapsed, toggleSidebar } = useAppShell();
  const canGoBack = useCanGoBack();
  const [canGoForward, setCanGoForward] = useState(false);
  const historyIndexRef = useRef(location.state.__TSR_index);

  useEffect(() => {
    const currentIndex = location.state.__TSR_index;

    if (currentIndex < historyIndexRef.current) {
      setCanGoForward(true);
    } else if (currentIndex > historyIndexRef.current) {
      setCanGoForward(false);
    }

    historyIndexRef.current = currentIndex;
  }, [location.state.__TSR_index]);
  let page: PageMeta = {
    title: 'YifuMusic',
    showSearch: true,
  };

  if (pathname === '/') {
    page = { title: t`首页`, showSearch: true };
  } else if (pathname === '/discover') {
    page = { title: t`发现`, showSearch: true };
  } else if (pathname === '/library') {
    page = { title: t`Library`, showSearch: true };
  } else if (pathname === '/artists/presets/compilations') {
    page = { title: t`Compilations`, showSearch: true };
  } else if (pathname.startsWith('/artists/')) {
    page = { title: t`Artists`, showSearch: true };
  } else if (pathname === '/artists') {
    page = { title: t`Artists`, showSearch: true };
  } else if (pathname.startsWith('/playlists/')) {
    page = { title: t`Playlists`, showSearch: true };
  } else if (pathname === '/playlists') {
    page = { title: t`Playlists`, showSearch: true };
  } else if (pathname === '/search') {
    page = { title: t`Search`, showSearch: true };
  } else if (pathname.startsWith('/tracks/')) {
    page = { title: t`Track details`, showSearch: false };
  } else if (pathname.startsWith('/settings')) {
    page = { title: t`Settings`, showSearch: false };
  }

  const isSideNavigation = navigationMode === 'side';

  return (
    <header
      aria-label={page.title}
      data-reference-layout="moekoe-titlebar"
      data-navigation-mode={navigationMode}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-tauri-drag-region
      {...stylex.props(
        styles.header,
        isSideNavigation ? styles.headerSide : styles.headerTop,
        isSideNavigation && sidebarCollapsed && styles.headerSideCollapsed,
      )}
    >
      <h1 {...stylex.props(styles.screenReaderOnly)}>{page.title}</h1>
      <div
        {...stylex.props(
          styles.headerInner,
          isSideNavigation ? styles.headerInnerSide : styles.headerInnerTop,
        )}
      >
        <div
          role="toolbar"
          data-reference-layout="moekoe-browser-controls"
          {...stylex.props(styles.navigationControls)}
        >
          {isSideNavigation && (
            <ButtonIcon
              icon={sidebarCollapsed ? 'panelLeftOpen' : 'panelLeftClose'}
              label={sidebarCollapsed ? t`Expand sidebar` : t`Collapse sidebar`}
              onClick={toggleSidebar}
              xstyle={styles.toolbarButton}
            />
          )}
          <ButtonIcon
            icon="chevronLeft"
            label={t`Back`}
            disabled={!canGoBack}
            onClick={() => router.history.back()}
            xstyle={styles.toolbarButton}
          />
          <ButtonIcon
            icon="chevronRight"
            label={t`Forward`}
            disabled={!canGoForward}
            onClick={() => router.history.forward()}
            xstyle={styles.toolbarButton}
          />
          <ButtonIcon
            icon="refresh"
            label={t`Refresh page`}
            onClick={() => window.location.reload()}
            xstyle={styles.toolbarButton}
          />
          {isSideNavigation && (
            <ButtonIcon
              disabled
              icon="microphone"
              label={t`听歌识曲（服务接入后可用）`}
              xstyle={styles.toolbarButton}
            />
          )}
        </div>

        {!isSideNavigation && (
          <nav aria-label={t`顶部导航`} {...stylex.props(styles.topNav)}>
            <TopNavItem to="/" label={t`首页`} />
            <TopNavItem to="/discover" label={t`发现`} />
            <TopNavItem to="/library" label={t`音乐库`} />
          </nav>
        )}

        <div
          {...stylex.props(styles.tools, isSideNavigation && styles.sideTools)}
        >
          {isSideNavigation || page.showSearch ? (
            <Search compact={isSideNavigation} />
          ) : null}
          {!isSideNavigation && (
            <ButtonIcon
              disabled
              icon="microphone"
              label={t`听歌识曲（服务接入后可用）`}
              xstyle={styles.recognizeButton}
            />
          )}
          {!isSideNavigation && <ProfileMenu variant="header" />}
        </div>
      </div>
    </header>
  );
}

const styles = stylex.create({
  header: {
    position: 'fixed',
    top: 0,
    right: 0,
    zIndex: 9,
    boxSizing: 'border-box',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
    backgroundColor: 'var(--header-bg)',
    boxShadow: 'var(--header-shadow)',
  },
  headerTop: {
    left: 0,
    minHeight: '64px',
    paddingBlock: '15px',
  },
  headerSide: {
    left: '226px',
    height: '52px',
    paddingInline: '16px',
    boxShadow: 'none',
    transition: 'left 200ms ease-out',
  },
  headerSideCollapsed: {
    left: {
      default: '67px',
      '@media (max-width: 767px)': '64px',
    },
  },
  headerInner: {
    minWidth: 0,
    marginInline: 'auto',
    display: 'flex',
    alignItems: 'center',
  },
  headerInnerTop: {
    width: 'min(1200px, 100%)',
    paddingInline: '20px',
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(180px, 1fr) auto minmax(180px, 1fr)',
      '@media (max-width: 767px)': 'auto minmax(0, 1fr) auto',
    },
    columnGap: '20px',
  },
  headerInnerSide: {
    width: '100%',
    justifyContent: 'space-between',
    columnGap: '14px',
  },
  navigationControls: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    columnGap: '6px',
  },
  toolbarButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    color: 'var(--text-secondary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
      ':active': 'var(--surface-selected)',
    },
  },
  topNav: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: {
      default: '34px',
      '@media (max-width: 999px)': '18px',
      '@media (max-width: 767px)': '10px',
    },
  },
  topNavLink: {
    minHeight: '34px',
    paddingBlock: '6px',
    paddingInline: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--accent)',
      ':is([data-status="active"])': 'var(--accent)',
    },
    fontSize: {
      default: '18px',
      '@media (max-width: 767px)': '14px',
    },
    fontWeight: 700,
    textDecorationLine: 'none',
    borderRadius: '6px',
    backgroundColor: {
      ':hover': 'var(--surface-hover)',
    },
  },
  tools: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: '12px',
  },
  sideTools: {
    justifyContent: 'flex-start',
    flexGrow: 1,
  },
  recognizeButton: {
    width: '30px',
    height: '30px',
    borderRadius: '999px',
    color: 'var(--text-secondary)',
  },
  screenReaderOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
});
