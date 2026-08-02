import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  Link as RouterLink,
  Outlet,
  useMatch,
  useNavigate,
} from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

import PlaylistsAPI from '../api/PlaylistsAPI';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import View from '../elements/View';
import type { Playlist, Track } from '../generated/typings';
import useInvalidate from '../hooks/useInvalidate';
import { allPlaylistsQuery, allTracksQuery } from '../lib/queries';
import queryClient from '../lib/query-client';

const playlistCategories = [
  { id: 'all', label: '全部歌单' },
  { id: 'imported', label: '从文件导入' },
  { id: 'manual', label: '手动创建' },
] as const;

type PlaylistCategory = (typeof playlistCategories)[number]['id'];

export const Route = createFileRoute('/playlists')({
  component: ViewPlaylists,
  loader: () => queryClient.prefetchQuery(allPlaylistsQuery),
});

function ViewPlaylists() {
  const { t } = useLingui();
  const { data: tracks = [] } = useQuery(allTracksQuery);
  const {
    data: playlists = [],
    isError: isPlaylistsError,
    isLoading: isPlaylistsLoading,
  } = useQuery(allPlaylistsQuery);

  const invalidate = useInvalidate();
  const navigate = useNavigate();

  const createPlaylist = useCallback(async () => {
    // TODO: 'new playlist 1', 'new playlist 2' ...
    const playlist = await PlaylistsAPI.create(t`New playlist`, [], false);

    if (playlist) {
      await invalidate();
      void navigate({
        to: '/playlists/$playlistID',
        params: { playlistID: playlist.id },
      });
    }
  }, [navigate, invalidate, t]);

  const childPlaylistMatch = useMatch({
    from: '/playlists/$playlistID',
    shouldThrow: false,
  });

  const playlistContent = childPlaylistMatch ? (
    <Outlet />
  ) : isPlaylistsLoading ? (
    <PlaylistOverviewState message="正在读取本地歌单..." />
  ) : isPlaylistsError ? (
    <PlaylistOverviewState message="无法读取本地歌单，请稍后重试。" isError />
  ) : (
    <PlaylistOverview
      playlists={playlists}
      tracks={tracks}
      onCreate={createPlaylist}
    />
  );

  return <View xstyle={styles.view}>{playlistContent}</View>;
}

function PlaylistOverviewState(props: { message: string; isError?: boolean }) {
  return (
    <section
      aria-live="polite"
      data-testid="playlist-overview-state"
      role={props.isError ? 'alert' : 'status'}
      {...stylex.props(
        styles.overview,
        styles.overviewState,
        props.isError && styles.overviewError,
      )}
    >
      {props.message}
    </section>
  );
}

function PlaylistOverview({
  playlists,
  tracks,
  onCreate,
}: {
  playlists: Array<Playlist>;
  tracks: Track[];
  onCreate: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<PlaylistCategory>('all');

  const visiblePlaylists = useMemo(() => {
    switch (activeCategory) {
      case 'imported':
        return playlists.filter((playlist) => playlist.import_path !== null);
      case 'manual':
        return playlists.filter((playlist) => playlist.import_path === null);
      default:
        return playlists;
    }
  }, [activeCategory, playlists]);

  const canCreatePlaylist = activeCategory !== 'imported';
  const importedCount = playlists.filter(
    (playlist) => playlist.import_path !== null,
  ).length;
  const manualCount = playlists.length - importedCount;

  return (
    <section
      aria-labelledby="playlist-overview-title"
      data-reference-layout="moekoe-playlist-overview"
      data-testid="playlist-overview"
      {...stylex.props(styles.overview)}
    >
      <header {...stylex.props(styles.header)}>
        <div>
          <p {...stylex.props(styles.eyebrow)}>本地播放列表</p>
          <h1 id="playlist-overview-title" {...stylex.props(styles.title)}>
            我的歌单
          </h1>
          <p {...stylex.props(styles.description)}>
            浏览从本地文件导入或在应用中创建的播放列表
          </p>
        </div>
        <dl aria-label="歌单统计" {...stylex.props(styles.stats)}>
          <div {...stylex.props(styles.stat)}>
            <dt {...stylex.props(styles.statLabel)}>全部</dt>
            <dd {...stylex.props(styles.statValue)}>{playlists.length}</dd>
          </div>
          <div {...stylex.props(styles.stat)}>
            <dt {...stylex.props(styles.statLabel)}>文件导入</dt>
            <dd {...stylex.props(styles.statValue)}>{importedCount}</dd>
          </div>
          <div {...stylex.props(styles.stat)}>
            <dt {...stylex.props(styles.statLabel)}>手动创建</dt>
            <dd {...stylex.props(styles.statValue)}>{manualCount}</dd>
          </div>
        </dl>
        <div aria-label="歌单总览操作" {...stylex.props(styles.headerActions)}>
          <RouterLink
            aria-label="导入本地歌单"
            title="导入本地歌单"
            to="/settings/library"
            draggable={false}
            {...stylex.props(styles.importAction)}
          >
            <span aria-hidden="true">
              <Icon name="playlist" size={16} />
            </span>
            <span>导入歌单</span>
          </RouterLink>
          <button
            aria-disabled="true"
            aria-label="在线收藏歌单，服务接入后可用"
            disabled
            title="在线收藏歌单：服务接入后可用"
            type="button"
            {...stylex.props(styles.disabledServiceAction)}
          >
            在线收藏
          </button>
        </div>
      </header>

      <div
        aria-label="歌单分类"
        role="tablist"
        {...stylex.props(styles.categoryTabs)}
      >
        {playlistCategories.map((category) => (
          <button
            key={category.id}
            aria-selected={activeCategory === category.id}
            role="tab"
            type="button"
            onClick={() => setActiveCategory(category.id)}
            {...stylex.props(
              styles.categoryTab,
              activeCategory === category.id && styles.categoryTabActive,
            )}
          >
            {category.label}
          </button>
        ))}
      </div>

      {playlists.length === 0 && (
        <div role="status" {...stylex.props(styles.emptyState)}>
          <strong>尚无播放列表</strong>
          <span>
            可在此创建歌单，或在音乐库设置中扫描包含 .m3u
            文件的音乐文件夹以导入歌单。
          </span>
        </div>
      )}

      {visiblePlaylists.length > 0 || canCreatePlaylist ? (
        <div data-testid="playlist-grid" {...stylex.props(styles.playlistGrid)}>
          {visiblePlaylists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              tracks={tracks}
            />
          ))}
          {canCreatePlaylist && <CreatePlaylistCard onCreate={onCreate} />}
        </div>
      ) : (
        <div role="status" {...stylex.props(styles.filteredEmpty)}>
          当前分类没有本地歌单。
        </div>
      )}
    </section>
  );
}

function PlaylistCard({
  playlist,
  tracks,
}: {
  playlist: Playlist;
  tracks: Track[];
}) {
  const isImported = playlist.import_path !== null;
  const coverTrack = tracks.find((track) => track.id === playlist.tracks[0]);

  return (
    <RouterLink
      aria-label={playlist.name}
      to="/playlists/$playlistID"
      params={{ playlistID: playlist.id }}
      draggable={false}
      data-museeks-action
      data-playlist-source={isImported ? 'imported' : 'manual'}
      {...stylex.props(styles.playlistCard)}
    >
      <span
        aria-hidden="true"
        data-no-cover={coverTrack === undefined ? 'true' : undefined}
        {...stylex.props(styles.noCoverArt)}
      >
        {coverTrack !== undefined ? (
          <span {...stylex.props(styles.coverArt)}>
            <Cover track={coverTrack} iconSize={28} />
          </span>
        ) : (
          <span {...stylex.props(styles.playlistDisc)}>
            <Icon name="playlist" size={28} />
          </span>
        )}
        <span {...stylex.props(styles.sourceBadge)}>
          {isImported ? '文件' : '手动'}
        </span>
      </span>
      <strong title={playlist.name} {...stylex.props(styles.playlistName)}>
        {playlist.name}
      </strong>
      <span {...stylex.props(styles.trackCount)}>
        {playlist.tracks.length} 首歌
      </span>
      <small
        title={playlist.import_path ?? '在应用中创建'}
        {...stylex.props(styles.playlistSource)}
      >
        {playlist.import_path ?? '手动创建'}
      </small>
    </RouterLink>
  );
}

function CreatePlaylistCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      aria-label="创建播放列表"
      type="button"
      onClick={onCreate}
      {...stylex.props(styles.createPlaylistCard)}
    >
      <span aria-hidden="true" {...stylex.props(styles.createPlaylistArt)}>
        <span {...stylex.props(styles.createPlaylistDisc)}>
          <Icon name="plus" size={28} />
        </span>
      </span>
      <strong {...stylex.props(styles.playlistName)}>创建歌单</strong>
      <span {...stylex.props(styles.trackCount)}>在应用中建立新歌单</span>
    </button>
  );
}

const styles = stylex.create({
  view: {
    padding: 0,
  },
  overview: {
    width: 'min(1200px, 100%)',
    marginInline: 'auto',
    padding: {
      default: '20px',
      '@media (max-width: 699px)': '20px 14px',
    },
  },
  header: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '20px',
    rowGap: '12px',
    flexWrap: 'wrap',
  },
  eyebrow: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  title: {
    marginBlock: 0,
    marginInline: 0,
    color: 'var(--accent)',
    fontSize: {
      default: '30px',
      '@media (max-width: 699px)': '25px',
    },
    lineHeight: 1.15,
  },
  description: {
    marginTop: '7px',
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  stats: {
    display: 'flex',
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  stat: {
    minWidth: '68px',
    paddingBlock: '9px',
    paddingInline: '12px',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-subtle)',
    textAlign: 'center',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
  importAction: {
    minHeight: '34px',
    paddingInline: '11px',
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '6px',
    color: 'var(--accent)',
    textDecorationLine: 'none',
    backgroundColor: 'var(--accent-subtle)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  disabledServiceAction: {
    minHeight: '34px',
    paddingInline: '11px',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    fontSize: '13px',
  },
  overviewState: {
    minHeight: '220px',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
  },
  overviewError: {
    color: 'var(--danger-color)',
  },
  statLabel: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
  },
  statValue: {
    marginTop: '3px',
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: 'var(--text-primary)',
    fontSize: '17px',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
  },
  categoryTabs: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: '10px',
    columnGap: '10px',
    marginBottom: '22px',
  },
  categoryTab: {
    minHeight: '42px',
    paddingBlock: '9px',
    paddingInline: '17px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: 0,
    borderRadius: '20px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 650,
    transition: {
      default:
        'background-color 220ms ease-out, color 220ms ease-out, box-shadow 220ms ease-out, transform 220ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-2px)',
    },
  },
  categoryTabActive: {
    color: '#ffffff',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 8px 18px color-mix(in srgb, var(--accent) 25%, transparent)',
  },
  playlistGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(178px, 1fr))',
    rowGap: '20px',
    columnGap: '18px',
  },
  playlistCard: {
    minWidth: 0,
    paddingBottom: '11px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    color: 'var(--text-primary)',
    textAlign: 'center',
    textDecorationLine: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: {
      default: 'transform 220ms ease-out, background-color 220ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-4px)',
    },
  },
  noCoverArt: {
    aspectRatio: '1',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    transition: {
      default: 'box-shadow 220ms ease-out, color 220ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    boxShadow: {
      ':hover': '0 16px 28px rgba(31, 41, 55, 0.16)',
    },
  },
  playlistDisc: {
    width: '72px',
    height: '72px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 10px 22px color-mix(in srgb, var(--accent) 30%, transparent)',
  },
  coverArt: {
    position: 'absolute',
    inset: 0,
    display: 'block',
  },
  sourceBadge: {
    position: 'absolute',
    right: '10px',
    bottom: '10px',
    paddingBlock: '4px',
    paddingInline: '7px',
    color: 'var(--accent)',
    borderRadius: '5px',
    backgroundColor: 'var(--surface-raised)',
    fontSize: '11px',
    fontWeight: 700,
  },
  playlistName: {
    minWidth: 0,
    marginTop: '11px',
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: '15px',
    lineHeight: 1.35,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCount: {
    minWidth: 0,
    marginTop: '4px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    lineHeight: 1.35,
  },
  playlistSource: {
    minWidth: 0,
    marginTop: '5px',
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    lineHeight: 1.35,
    opacity: 0.78,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  createPlaylistCard: {
    minWidth: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    color: 'var(--accent)',
    textAlign: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: {
      default: 'transform 220ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-4px)',
    },
  },
  createPlaylistArt: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundImage:
      'linear-gradient(145deg, var(--accent-subtle), var(--surface-raised) 72%)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent)',
    borderRadius: '8px',
  },
  createPlaylistDisc: {
    width: '66px',
    height: '66px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '50%',
    backgroundColor: 'var(--surface-raised)',
  },
  filteredEmpty: {
    minHeight: '180px',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-subtle)',
    borderRadius: '16px',
    fontSize: '14px',
  },
  emptyState: {
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
});
