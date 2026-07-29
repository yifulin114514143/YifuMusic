import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import type { LinkProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import useLibraryStore from '../lib/store';
import Icon from './Icon';
import ProgressBar from './ProgressBar';
import TrackListStatus from './TrackListStatus';

type NavItemProps = {
  to: LinkProps['to'];
  label: string;
  children: ReactNode;
};

function NavItem({ to, label, children }: NavItemProps) {
  return (
    <NavigationMenu.Item {...stylex.props(styles.navigationItem)}>
      <NavigationMenu.Link
        render={(renderProps) => (
          <Link
            {...renderProps}
            to={to}
            title={label}
            aria-label={label}
            draggable={false}
            {...stylex.props(styles.navigationLink)}
          >
            <span {...stylex.props(styles.navigationIcon)}>{children}</span>
            <span {...stylex.props(styles.navigationLabel)}>{label}</span>
          </Link>
        )}
      />
    </NavigationMenu.Item>
  );
}

export default function Navigation() {
  const { t } = useLingui();
  const platform = window.__MUSEEKS_PLATFORM;

  return (
    <aside
      aria-label={t`YifuMusic sidebar`}
      {...stylex.props(styles.navigation)}
    >
      <div
        {...stylex.props(
          styles.brand,
          platform === 'macos' && styles.brandMacos,
        )}
      >
        <span {...stylex.props(styles.brandMark)}>
          <Icon name="musicalNotes" size={20} />
        </span>
        <span {...stylex.props(styles.brandName)}>YifuMusic</span>
      </div>

      <NavigationMenu.Root
        orientation="vertical"
        aria-label={t`Main navigation`}
        {...stylex.props(styles.navigationRoot)}
      >
        <div {...stylex.props(styles.viewLinksContainer)}>
          <span {...stylex.props(styles.groupLabel)}>{t`Library`}</span>
          <NavigationMenu.List {...stylex.props(styles.viewLinks)}>
            <NavItem to="/library" label={t`Library`}>
              <Icon name="musicalNotes" size={16} />
            </NavItem>
            <NavItem to="/artists" label={t`Artists`}>
              <Icon name="microphone" size={16} />
            </NavItem>
            <NavItem to="/playlists" label={t`Playlists`}>
              <Icon name="playlist" size={16} />
            </NavItem>
          </NavigationMenu.List>
        </div>

        <div {...stylex.props(styles.systemLinks)}>
          <span {...stylex.props(styles.groupLabel)}>{t`System`}</span>
          <NavigationMenu.List {...stylex.props(styles.viewLinks)}>
            <NavItem to="/settings" label={t`Settings`}>
              <Icon name="settings" size={16} />
            </NavItem>
          </NavigationMenu.List>
        </div>
      </NavigationMenu.Root>

      <div {...stylex.props(styles.status)} aria-label={t`Library status`}>
        <Status />
      </div>
    </aside>
  );
}

function Status() {
  const refresh = useLibraryStore((state) => state.refresh);
  const refreshing = useLibraryStore((state) => state.refreshing);
  const status = useLibraryStore((state) => state.tracksStatus);
  const { t } = useLingui();

  const { current, total } = refresh;

  if (refreshing) {
    const isScanning = total === 0;
    const progress = total > 0 ? Math.round((current / total) * 100) : 100;

    return (
      <div {...stylex.props(styles.statusLibraryRefresh)}>
        <div {...stylex.props(styles.statusLibraryRefreshProgress)}>
          {isScanning ? (
            t`scanning tracks...`
          ) : (
            <ProgressBar
              progress={progress}
              label={total > 0 ? `${current} / ${total}` : ''}
            />
          )}
        </div>
      </div>
    );
  }

  if (status != null) {
    return <TrackListStatus {...status} />;
  }

  return null;
}

const styles = stylex.create({
  navigation: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    paddingBlock: {
      default: '16px',
      '@media (max-width: 899px)': '12px',
    },
    paddingInline: {
      default: '12px',
      '@media (max-width: 899px)': '8px',
    },
    backgroundColor: 'var(--surface-raised)',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-subtle)',
    alignItems: {
      default: 'stretch',
      '@media (max-width: 899px)': 'center',
    },
  },
  brand: {
    minHeight: '40px',
    marginBottom: {
      default: '28px',
      '@media (max-width: 899px)': '20px',
    },
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
  },
  brandMacos: {
    paddingLeft: {
      default: '64px',
      '@media (max-width: 899px)': 0,
    },
    paddingTop: {
      '@media (max-width: 899px)': '40px',
    },
  },
  brandMark: {
    width: '36px',
    height: '36px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent-contrast)',
    backgroundColor: 'var(--accent)',
    borderRadius: 'var(--radius-md)',
  },
  brandName: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    lineHeight: 1,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    display: {
      default: 'inline',
      '@media (max-width: 899px)': 'none',
    },
  },
  navigationRoot: {
    minHeight: 0,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  viewLinksContainer: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '8px',
    minHeight: 0,
  },
  viewLinks: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  groupLabel: {
    paddingInline: '8px',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1,
    display: {
      default: 'inline',
      '@media (max-width: 899px)': 'none',
    },
  },
  navigationItem: {
    minWidth: 0,
  },
  navigationLink: {
    minHeight: '40px',
    width: {
      '@media (max-width: 899px)': '40px',
    },
    paddingBlock: '8px',
    paddingInline: {
      default: '10px',
      '@media (max-width: 899px)': 0,
    },
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    borderRadius: 'var(--radius-sm)',
    boxShadow: {
      default: 'inset 3px 0 0 transparent',
      ':hover': 'inset 3px 0 0 var(--accent)',
      '[data-status="active"]': 'inset 3px 0 0 var(--accent)',
    },
    backgroundColor: {
      ':hover': 'var(--surface-hover)',
      '[data-status="active"]': 'var(--surface-selected)',
    },
    fontWeight: {
      default: 500,
      '[data-status="active"]': 700,
    },
    justifyContent: {
      default: 'flex-start',
      '@media (max-width: 899px)': 'center',
    },
  },
  navigationIcon: {
    width: '20px',
    height: '20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: {
      default: 'inline',
      '@media (max-width: 899px)': 'none',
    },
  },
  systemLinks: {
    marginTop: 'auto',
    paddingTop: {
      default: '24px',
      '@media (max-width: 899px)': '16px',
    },
  },
  status: {
    marginTop: '16px',
    paddingInline: '8px',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    lineHeight: 1.4,
    display: {
      default: 'flex',
      '@media (max-width: 899px)': 'none',
    },
    justifyContent: 'flex-start',
  },
  statusLibraryRefresh: {
    display: 'flex',
    flexGrow: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  statusLibraryRefreshProgress: {
    flexGrow: 1,
    minWidth: 0,
  },
});
