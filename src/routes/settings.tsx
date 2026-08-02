import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getTauriVersion, getVersion } from '@tauri-apps/api/app';

import Icon from '../components/Icon';
import { SettingsNav, SettingsNavLink } from '../elements/SettingsNav';
import View from '../elements/View';
import ConfigBridge from '../lib/bridge-config';

export const Route = createFileRoute('/settings')({
  component: ViewSettings,
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/settings') {
      throw redirect({ to: '/settings/library' });
    }
  },
  async loader() {
    const [version, tauriVersion, appStorageDir] = await Promise.all([
      getVersion(),
      getTauriVersion(),
      ConfigBridge.getStorageDir(),
    ]);

    return {
      version,
      tauriVersion,
      appStorageDir,
      buildIdentity: window.__MUSEEKS_BUILD_IDENTITY,
    };
  },
});

function ViewSettings() {
  const { t } = useLingui();
  const { tauriVersion, version } = Route.useLoaderData();

  return (
    <View xstyle={styles.view}>
      <div
        data-reference-layout="moekoe-settings"
        data-testid="moekoe-settings"
        {...stylex.props(styles.layout)}
      >
        <aside
          aria-label={t`Settings categories`}
          {...stylex.props(styles.nav)}
        >
          <div {...stylex.props(styles.navIntro)}>
            <p {...stylex.props(styles.navEyebrow)}>YifuMusic</p>
            <strong>设置</strong>
            <span>本地音乐播放器</span>
          </div>
          <nav aria-label={t`Settings categories`}>
            <SettingsNav>
              <SettingsNavLink to="/settings/library">
                <span {...stylex.props(styles.categoryLinkContent)}>
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.categoryIcon)}
                  >
                    <Icon name="hardDrive" size={16} />
                  </span>
                  <Trans>Library</Trans>
                </span>
              </SettingsNavLink>
              <SettingsNavLink to="/settings/audio">
                <span {...stylex.props(styles.categoryLinkContent)}>
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.categoryIcon)}
                  >
                    <Icon name="volumeHigh" size={16} />
                  </span>
                  <Trans>Audio</Trans>
                </span>
              </SettingsNavLink>
              <SettingsNavLink to="/settings/ui">
                <span {...stylex.props(styles.categoryLinkContent)}>
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.categoryIcon)}
                  >
                    <Icon name="settings" size={16} />
                  </span>
                  <Trans>Interface</Trans>
                </span>
              </SettingsNavLink>
              <SettingsNavLink to="/settings/about">
                <span {...stylex.props(styles.categoryLinkContent)}>
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.categoryIcon)}
                  >
                    <Icon name="fileText" size={16} />
                  </span>
                  <Trans>About</Trans>
                </span>
              </SettingsNavLink>
            </SettingsNav>
          </nav>
          <div {...stylex.props(styles.navFooter)}>
            <span>本机设置</span>
            <span>V{version}</span>
          </div>
        </aside>

        <section
          aria-label={t`Settings`}
          data-testid="settings-content"
          {...stylex.props(styles.content)}
        >
          <Outlet />
          <footer aria-label="版本信息" {...stylex.props(styles.footer)}>
            <span>© YifuMusic</span>
            <span>
              V{version} · Tauri {tauriVersion}
            </span>
          </footer>
        </section>
      </div>
    </View>
  );
}

const styles = stylex.create({
  view: {
    padding: 0,
  },
  layout: {
    minHeight: 0,
    flexGrow: 1,
    display: 'grid',
    gridTemplateColumns: {
      default: '280px minmax(0, 1fr)',
      '@media (max-width: 699px)': 'minmax(0, 1fr)',
    },
    gridTemplateRows: {
      '@media (max-width: 699px)': 'auto minmax(0, 1fr)',
    },
    columnGap: 0,
    rowGap: {
      default: 0,
      '@media (max-width: 699px)': 0,
    },
    overflow: 'hidden',
    backgroundColor: 'var(--surface-canvas)',
  },
  nav: {
    minWidth: 0,
    minHeight: 0,
    paddingBlock: {
      default: '30px 18px',
      '@media (max-width: 699px)': '10px',
    },
    paddingInline: '14px',
    overflowX: {
      default: 'visible',
      '@media (max-width: 699px)': 'auto',
    },
    overflowY: {
      default: 'auto',
      '@media (max-width: 699px)': 'visible',
    },
    display: 'flex',
    flexDirection: 'column',
    rowGap: '24px',
    backgroundColor: 'var(--surface-sunken)',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-subtle)',
  },
  navIntro: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    paddingInline: '8px',
  },
  navEyebrow: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.1em',
  },
  navFooter: {
    marginTop: 'auto',
    paddingTop: '14px',
    paddingInline: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    color: 'var(--text-secondary)',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-subtle)',
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
  },
  categoryLinkContent: {
    display: 'inline-flex',
    alignItems: 'center',
    minWidth: 0,
    rowGap: '12px',
    columnGap: '12px',
  },
  categoryIcon: {
    width: '20px',
    height: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--main-color)',
  },
  content: {
    minWidth: 0,
    minHeight: 0,
    padding: {
      default: '32px 28px',
      '@media (max-width: 699px)': '14px',
    },
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 1249px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 899px)': 'minmax(0, 1fr)',
    },
    alignContent: 'start',
    rowGap: '20px',
    columnGap: '20px',
  },
  footer: {
    gridColumnStart: '1',
    gridColumnEnd: '-1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    rowGap: '4px',
    columnGap: '4px',
    paddingTop: '16px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.4,
    textAlign: 'center',
  },
});
