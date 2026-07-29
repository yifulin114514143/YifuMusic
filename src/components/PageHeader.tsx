import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useLocation } from '@tanstack/react-router';

import Search from './Search';

type PageMeta = {
  title: string;
  scope: string;
  showSearch: boolean;
};

export default function PageHeader() {
  const { pathname } = useLocation();
  const { t } = useLingui();
  let page: PageMeta = {
    title: 'YifuMusic',
    scope: t`Local music`,
    showSearch: true,
  };

  if (pathname === '/library') {
    page = { title: t`Library`, scope: t`Local music`, showSearch: true };
  } else if (pathname === '/artists/presets/compilations') {
    page = {
      title: t`Compilations`,
      scope: t`Artist collection`,
      showSearch: true,
    };
  } else if (pathname.startsWith('/artists/')) {
    page = {
      title: t`Artists`,
      scope: t`Tracks and albums`,
      showSearch: true,
    };
  } else if (pathname === '/artists') {
    page = {
      title: t`Artists`,
      scope: t`Local index`,
      showSearch: true,
    };
  } else if (pathname.startsWith('/playlists/')) {
    page = {
      title: t`Playlists`,
      scope: t`Local playlists`,
      showSearch: true,
    };
  } else if (pathname === '/playlists') {
    page = {
      title: t`Playlists`,
      scope: t`Local playlists`,
      showSearch: true,
    };
  } else if (pathname.startsWith('/tracks/')) {
    page = {
      title: t`Track details`,
      scope: t`Local metadata`,
      showSearch: false,
    };
  } else if (pathname.startsWith('/settings')) {
    page = {
      title: t`Settings`,
      scope: t`Application preferences`,
      showSearch: false,
    };
  }

  return (
    <header data-tauri-drag-region {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.titleGroup)}>
        <span {...stylex.props(styles.eyebrow)}>YifuMusic</span>
        <div {...stylex.props(styles.titleLine)}>
          <h1 {...stylex.props(styles.title)}>{page.title}</h1>
          <span {...stylex.props(styles.scope)}>{page.scope}</span>
        </div>
      </div>
      {page.showSearch && (
        <div {...stylex.props(styles.tools)}>
          <Search />
        </div>
      )}
    </header>
  );
}

const styles = stylex.create({
  header: {
    minHeight: {
      default: '76px',
      '@media (max-width: 899px)': '64px',
    },
    paddingBlock: {
      default: '16px',
      '@media (max-width: 899px)': '12px',
    },
    paddingInline: {
      default: '24px',
      '@media (max-width: 899px)': '16px',
    },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
    backgroundColor: 'var(--surface-canvas)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '16px',
  },
  titleGroup: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
  },
  eyebrow: {
    color: 'var(--accent)',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1,
    textTransform: 'uppercase',
  },
  titleLine: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: '8px',
  },
  title: {
    minWidth: 0,
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '22px',
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: 0,
  },
  scope: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    display: {
      default: 'inline',
      '@media (max-width: 599px)': 'none',
    },
  },
  tools: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
  },
});
