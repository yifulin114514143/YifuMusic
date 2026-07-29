import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getTauriVersion, getVersion } from '@tauri-apps/api/app';

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

    return { version, tauriVersion, appStorageDir };
  },
});

function ViewSettings() {
  const { t } = useLingui();

  return (
    <View hasPadding xstyle={styles.view}>
      <div {...stylex.props(styles.layout)}>
        <aside
          aria-label={t`Settings categories`}
          {...stylex.props(styles.nav)}
        >
          <h2 {...stylex.props(styles.title)}>
            <Trans>Settings categories</Trans>
          </h2>
          <SettingsNav>
            <SettingsNavLink to="/settings/library">
              <Trans>Library</Trans>
            </SettingsNavLink>
            <SettingsNavLink to="/settings/audio">
              <Trans>Audio</Trans>
            </SettingsNavLink>
            <SettingsNavLink to="/settings/ui">
              <Trans>Interface</Trans>
            </SettingsNavLink>
            <SettingsNavLink to="/settings/about">
              <Trans>About</Trans>
            </SettingsNavLink>
          </SettingsNav>
        </aside>

        <section {...stylex.props(styles.content)}>
          <Outlet />
        </section>
      </div>
    </View>
  );
}

const styles = stylex.create({
  view: {
    padding: {
      default: '24px',
      '@media (max-width: 699px)': '16px',
    },
  },
  layout: {
    minHeight: 0,
    flexGrow: 1,
    display: 'grid',
    gridTemplateColumns: {
      default: '180px minmax(0, 1fr)',
      '@media (max-width: 699px)': 'minmax(0, 1fr)',
    },
    columnGap: '32px',
    rowGap: {
      default: 0,
      '@media (max-width: 699px)': '16px',
    },
  },
  nav: {
    minWidth: 0,
    alignSelf: 'start',
    padding: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-raised)',
  },
  title: {
    marginTop: 0,
    marginBottom: '12px',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  content: {
    minWidth: 0,
    maxWidth: '760px',
  },
});
