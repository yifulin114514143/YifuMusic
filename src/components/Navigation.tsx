import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import type { LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { useAppShell } from './AppShellContext';
import Icon from './Icon';
import ProfileMenu from './ProfileMenu';
import Search from './Search';

type NavItemProps = {
  to: LinkProps['to'];
  label: string;
  isCompact: boolean;
  children: ReactNode;
};

function NavItem({ to, label, isCompact, children }: NavItemProps) {
  return (
    <NavigationMenu.Item {...stylex.props(styles.navigationItem)}>
      <NavigationMenu.Link
        render={(renderProps) => (
          <Link
            {...renderProps}
            aria-label={label}
            title={label}
            to={to}
            draggable={false}
            data-museeks-action
            {...stylex.props(
              styles.navigationLink,
              isCompact && styles.navigationLinkCompact,
            )}
          >
            <span aria-hidden="true" {...stylex.props(styles.navigationIcon)}>
              {children}
            </span>
            <span
              {...stylex.props(
                styles.navigationLabel,
                isCompact && styles.navigationLabelCompact,
              )}
            >
              {label}
            </span>
          </Link>
        )}
      />
    </NavigationMenu.Item>
  );
}

type UnavailableNavItemProps = {
  label: string;
  isCompact: boolean;
  children: ReactNode;
};

function UnavailableNavItem({
  label,
  isCompact,
  children,
}: UnavailableNavItemProps) {
  return (
    <NavigationMenu.Item {...stylex.props(styles.navigationItem)}>
      <button
        aria-label={label}
        aria-disabled="true"
        disabled
        title={label}
        type="button"
        {...stylex.props(
          styles.navigationLink,
          styles.navigationLinkUnavailable,
          isCompact && styles.navigationLinkCompact,
        )}
      >
        <span aria-hidden="true" {...stylex.props(styles.navigationIcon)}>
          {children}
        </span>
        <span
          {...stylex.props(
            styles.navigationLabel,
            isCompact && styles.navigationLabelCompact,
          )}
        >
          {label}
        </span>
      </button>
    </NavigationMenu.Item>
  );
}

export default function Navigation() {
  const { t } = useLingui();
  const { sidebarCollapsed } = useAppShell();

  return (
    <aside
      aria-label={t`YifuMusic sidebar`}
      data-collapsed={sidebarCollapsed || undefined}
      data-reference-layout="moekoe-rail"
      {...stylex.props(
        styles.navigation,
        sidebarCollapsed && styles.navigationCompact,
      )}
    >
      <div
        {...stylex.props(
          styles.profile,
          sidebarCollapsed && styles.profileCompact,
        )}
      >
        <ProfileMenu compact={sidebarCollapsed} variant="sidebar" />
      </div>

      <div
        {...stylex.props(
          styles.navigationMain,
          sidebarCollapsed && styles.navigationMainCompact,
        )}
      >
        {sidebarCollapsed ? (
          <Link
            aria-label={t`Search`}
            title={t`Search`}
            to="/search"
            draggable={false}
            data-museeks-action
            {...stylex.props(styles.compactSearchLink)}
          >
            <Icon name="search" size={16} />
          </Link>
        ) : (
          <div {...stylex.props(styles.searchWrapper)}>
            <Search />
          </div>
        )}

        <NavigationMenu.Root
          aria-label={t`Main navigation`}
          orientation="vertical"
          {...stylex.props(styles.navigationRoot)}
        >
          <NavigationMenu.List {...stylex.props(styles.navigationList)}>
            <NavItem to="/" label={t`首页`} isCompact={sidebarCollapsed}>
              <Icon name="house" size={20} />
            </NavItem>
            <NavItem
              to="/discover"
              label={t`发现`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="compass" size={20} />
            </NavItem>
            <NavItem
              to="/library"
              label={t`音乐库`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="musicalNotes" size={20} />
            </NavItem>
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <NavigationMenu.Root
          aria-label={t`Library navigation`}
          orientation="vertical"
          {...stylex.props(styles.libraryNavigation)}
        >
          <span
            {...stylex.props(
              styles.sectionTitle,
              sidebarCollapsed && styles.sectionTitleCompact,
            )}
          >
            {t`音乐库`}
          </span>
          <NavigationMenu.List {...stylex.props(styles.navigationList)}>
            <NavItem
              to="/local-music"
              label={t`本地音乐`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="hardDrive" size={20} />
            </NavItem>
            <UnavailableNavItem
              label={t`我的云盘（服务接入后可用）`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="cloud" size={20} />
            </UnavailableNavItem>
            <UnavailableNavItem
              label={t`听歌识曲（服务接入后可用）`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="microphone" size={20} />
            </UnavailableNavItem>
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <NavigationMenu.Root
          aria-label={t`Playlist navigation`}
          orientation="vertical"
          {...stylex.props(styles.playlistNavigation)}
        >
          <span
            {...stylex.props(
              styles.sectionTitle,
              sidebarCollapsed && styles.sectionTitleCompact,
            )}
          >
            {t`我的歌单`}
          </span>
          <NavigationMenu.List {...stylex.props(styles.navigationList)}>
            <NavItem
              to="/playlists"
              label={t`我的歌单`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="playlist" size={20} />
            </NavItem>
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <NavigationMenu.Root
          aria-label={t`System navigation`}
          orientation="vertical"
          {...stylex.props(styles.systemNavigation)}
        >
          <NavigationMenu.List {...stylex.props(styles.navigationList)}>
            <NavItem
              to="/settings"
              label={t`Settings`}
              isCompact={sidebarCollapsed}
            >
              <Icon name="settings" size={20} />
            </NavItem>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    </aside>
  );
}

const styles = stylex.create({
  navigation: {
    minWidth: 0,
    height: 'calc(100dvh - 78px)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--sidebar-bg)',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-subtle)',
    boxShadow: '2px 0 18px rgba(24, 66, 99, 0.08)',
    overflowX: 'hidden',
    overflowY: 'hidden',
    transition: 'width 200ms ease-out',
  },
  navigationCompact: {
    alignItems: 'stretch',
  },
  profile: {
    minHeight: '76px',
    paddingBlock: '15px',
    paddingInline: '12px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    color: 'var(--text-primary)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
    backgroundColor: {
      default: 'var(--sidebar-bg)',
      ':hover': 'var(--sidebar-bg)',
    },
  },
  profileCompact: {
    minHeight: '76px',
    justifyContent: 'center',
    paddingInline: 0,
  },
  navigationMain: {
    minWidth: 0,
    minHeight: 0,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '12px',
    paddingInline: '10px',
    paddingBottom: '10px',
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  navigationMainCompact: {
    alignItems: 'center',
    paddingInline: '10px',
  },
  searchWrapper: {
    width: '100%',
    marginBottom: '16px',
  },
  compactSearchLink: {
    width: '42px',
    height: '38px',
    flexShrink: 0,
    marginBottom: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: {
      default: 'var(--accent)',
      ':hover': 'var(--accent)',
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    borderRadius: '10px',
    textDecorationLine: 'none',
  },
  navigationRoot: {
    width: '100%',
    minWidth: 0,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  libraryNavigation: {
    flexShrink: 0,
    marginTop: '18px',
  },
  playlistNavigation: {
    minHeight: '68px',
    flexGrow: 1,
    flexShrink: 1,
    marginTop: '18px',
    overflowY: 'auto',
  },
  navigationList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '6px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  navigationItem: {
    minWidth: 0,
  },
  navigationLink: {
    minWidth: 0,
    minHeight: '38px',
    paddingBlock: 0,
    paddingInline: '10px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '12px',
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--text-primary)',
      ':is([data-status="active"])': 'var(--accent)',
    },
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
      ':is([data-status="active"])': 'var(--surface-selected)',
    },
    borderRadius: '10px',
    boxShadow: {
      default: 'inset 0 0 0 1px transparent',
      ':is([data-status="active"])': 'inset 0 0 0 1px transparent',
    },
    fontSize: '14px',
    fontWeight: 500,
    textDecorationLine: 'none',
    borderStyle: 'none',
    cursor: 'pointer',
  },
  navigationLinkUnavailable: {
    width: '100%',
    textAlign: 'left',
    opacity: 0.54,
    cursor: 'not-allowed',
  },
  navigationLinkCompact: {
    width: '42px',
    minWidth: '42px',
    padding: 0,
    justifyContent: 'center',
  },
  navigationIcon: {
    width: '20px',
    height: '20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
  },
  navigationLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  navigationLabelCompact: {
    display: 'none',
  },
  systemNavigation: {
    flexShrink: 0,
    paddingTop: '14px',
    marginTop: '18px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-subtle)',
  },
  sectionTitle: {
    paddingInline: '8px',
    paddingBottom: '6px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 700,
  },
  sectionTitleCompact: {
    height: 0,
    padding: 0,
    overflow: 'hidden',
    visibility: 'hidden',
  },
});
