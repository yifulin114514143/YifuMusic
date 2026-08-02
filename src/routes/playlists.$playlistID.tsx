import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { ask } from '@tauri-apps/plugin-dialog';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import PlaylistsAPI from '../api/PlaylistsAPI';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import TrackList from '../components/TrackList';
import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import Link from '../elements/Link';
import * as ViewMessage from '../elements/ViewMessage';
import type { Track } from '../generated/typings';
import useFilteredTracks from '../hooks/useFilteredTracks';
import { parseDuration } from '../hooks/useFormattedDuration';
import useGlobalTrackListStatus from '../hooks/useGlobalTrackListStatus';
import useInvalidate from '../hooks/useInvalidate';
import DatabaseBridge from '../lib/bridge-database';
import player from '../lib/player';
import { allPlaylistsQuery, configQuery } from '../lib/queries';
import useLibraryStore from '../lib/store';
import type { QueueOrigin } from '../types/museeks';

export const Route = createFileRoute('/playlists/$playlistID')({
  component: ViewPlaylistDetails,
  loader: async ({ params }) => {
    try {
      const playlist = await DatabaseBridge.getPlaylist(params.playlistID);
      const playlistTracks = await DatabaseBridge.getTracks(playlist.tracks);

      return { playlist, playlistTracks };
    } catch (err) {
      if (err === 'Playlist not found') {
        throw redirect({ to: '/playlists' });
      }

      throw err;
    }
  },
});

function ViewPlaylistDetails() {
  const { playlist, playlistTracks } = Route.useLoaderData();
  const { data: playlists = [] } = useQuery(allPlaylistsQuery);
  const { playlistID } = Route.useParams();
  const config = useSuspenseQuery(configQuery).data;

  const { t } = useLingui();

  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [isRenaming, setIsRenaming] = useState(false);
  const [playlistName, setPlaylistName] = useState(playlist.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) renameInputRef.current?.focus();
  }, [isRenaming]);

  const search = useLibraryStore((state) => state.search);
  const filteredTracks = useFilteredTracks(playlistTracks);
  useGlobalTrackListStatus(filteredTracks);

  const queueOrigin = useMemo(() => {
    return { type: 'playlist', playlistID } satisfies QueueOrigin;
  }, [playlistID]);

  const onReorder = useCallback(
    async (tracks: Track[]) => {
      if (playlistID != null) {
        await PlaylistsAPI.reorderTracks(playlistID, tracks);
        await invalidate();
      }
    },
    [invalidate, playlistID],
  );

  const extraContextMenu = useMemo(() => {
    return [
      {
        label: t`Remove from playlist`,
        action: async (selectedTracks: Set<string>) => {
          const confirmed = await ask(
            t`This will remove the selected tracks from "${playlist.name}".`,
            {
              title: t`Remove tracks from playlist?`,
              kind: 'warning',
              cancelLabel: t`Cancel`,
              okLabel: t`Remove`,
            },
          );

          if (!confirmed) return;

          await PlaylistsAPI.removeTracks(
            playlistID,
            Array.from(selectedTracks),
          );
          await invalidate();
        },
      },
    ];
  }, [playlistID, invalidate, playlist.name, t]);

  const renamePlaylist = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextName = playlistName.trim();

      if (nextName === '') return;

      if (nextName !== playlist.name) {
        await PlaylistsAPI.rename(playlistID, nextName);
        await invalidate();
      }

      setIsRenaming(false);
    },
    [invalidate, playlist.name, playlistID, playlistName],
  );

  const clearPlaylist = useCallback(async () => {
    const confirmed = await ask(
      t`This will remove all tracks from "${playlist.name}".`,
      {
        title: t`Clear playlist?`,
        kind: 'warning',
        cancelLabel: t`Cancel`,
        okLabel: t`Clear`,
      },
    );

    if (confirmed) {
      await DatabaseBridge.setPlaylistTracks(playlistID, []);
      await invalidate();
    }
  }, [invalidate, playlist.name, playlistID, t]);

  const deletePlaylist = useCallback(async () => {
    const confirmed = await ask(
      t`This will permanently delete "${playlist.name}".`,
      {
        title: t`Delete playlist?`,
        kind: 'warning',
        cancelLabel: t`Cancel`,
        okLabel: t`Delete`,
      },
    );

    if (confirmed) {
      await PlaylistsAPI.remove(playlistID);
      await invalidate();
      void navigate({ to: '/playlists' });
    }
  }, [invalidate, navigate, playlist.name, playlistID, t]);

  const playlistDuration = useMemo(
    () => playlistTracks.reduce((total, track) => total + track.duration, 0),
    [playlistTracks],
  );
  const playlistSource =
    playlist.import_path === null ? '手动创建' : '从文件导入';
  const addAllToQueue = useCallback(() => {
    player.addToQueue(playlistTracks);
  }, [playlistTracks]);

  let body: React.ReactNode;

  if (playlistTracks.length === 0) {
    body = (
      <ViewMessage.Notice>
        <p>
          <Trans>Empty playlist</Trans>
        </p>
        <ViewMessage.Sub>
          <Trans>
            You can add tracks from the{' '}
            <Link linkOptions={{ to: '/library' }}>library view</Link>
          </Trans>
        </ViewMessage.Sub>
      </ViewMessage.Notice>
    );
  } else if (filteredTracks.length === 0 && search.length > 0) {
    body = (
      <ViewMessage.Notice>
        <p>
          <Trans>Your search returned no results</Trans>
        </p>
      </ViewMessage.Notice>
    );
  } else if (filteredTracks.length === 0) {
    body = (
      <ViewMessage.Notice>
        <p>
          <Trans>Empty playlist</Trans>
        </p>
        <ViewMessage.Sub>
          <Trans>
            You can add tracks from the{' '}
            <Link linkOptions={{ to: '/library' }}>library view</Link>
          </Trans>
        </ViewMessage.Sub>
      </ViewMessage.Notice>
    );
  } else {
    body = (
      <TrackList
        layout="default"
        data={filteredTracks}
        tracksDensity={config.track_view_density}
        playlists={playlists}
        queueOrigin={queueOrigin}
        onReorder={onReorder}
        reorderable={true}
        extraContextMenu={extraContextMenu}
      />
    );
  }

  return (
    <div {...stylex.props(styles.page)}>
      <section
        aria-label={`本地歌单资料：${playlist.name}`}
        data-reference-layout="moekoe-playlist-detail"
        {...stylex.props(styles.hero)}
      >
        <span aria-hidden="true" {...stylex.props(styles.artwork)}>
          {playlistTracks[0] !== undefined ? (
            <Cover track={playlistTracks[0]} iconSize={36} />
          ) : (
            <span {...stylex.props(styles.emptyArtwork)}>
              <Icon name="playlist" size={36} />
            </span>
          )}
          <span {...stylex.props(styles.artworkBadge)}>本地歌单</span>
        </span>
        <div {...stylex.props(styles.heroCopy)}>
          <span {...stylex.props(styles.eyebrow)}>播放列表</span>
          <h2 id="playlist-detail-title" {...stylex.props(styles.title)}>
            {playlist.name}
          </h2>
          <p {...stylex.props(styles.description)}>
            {playlistSource} · 仅展示当前设备已经保存的本地曲目
          </p>
          {playlist.import_path !== null && (
            <p
              title={playlist.import_path}
              {...stylex.props(styles.importPath)}
            >
              {playlist.import_path}
            </p>
          )}
          <dl {...stylex.props(styles.stats)}>
            <div {...stylex.props(styles.stat)}>
              <dt {...stylex.props(styles.statLabel)}>歌曲</dt>
              <dd {...stylex.props(styles.statValue)}>
                {playlistTracks.length} 首歌曲
              </dd>
            </div>
            <div {...stylex.props(styles.stat)}>
              <dt {...stylex.props(styles.statLabel)}>总时长</dt>
              <dd {...stylex.props(styles.statValue)}>
                {parseDuration(playlistDuration)}
              </dd>
            </div>
            <div {...stylex.props(styles.stat)}>
              <dt {...stylex.props(styles.statLabel)}>来源</dt>
              <dd {...stylex.props(styles.statValue)}>{playlistSource}</dd>
            </div>
          </dl>
        </div>
        <div
          aria-label="播放与编辑歌单"
          role="group"
          {...stylex.props(styles.actions)}
        >
          {playlistTracks.length > 0 && (
            <>
              <button
                aria-label={t`Play all`}
                title={t`Play all`}
                type="button"
                onClick={() => void PlaylistsAPI.play(playlistID)}
                {...stylex.props(styles.playAllAction)}
              >
                <Icon name="play" size={16} />
                <span>{t`Play all`}</span>
              </button>
              <ButtonIcon
                icon="list"
                label={t`Add all to queue`}
                onClick={addAllToQueue}
                xstyle={styles.secondaryIconAction}
              />
            </>
          )}
          <Button
            type="button"
            onClick={() => void navigate({ to: '/playlists' })}
          >
            返回歌单
          </Button>
          <Button
            id="rename-playlist-trigger"
            type="button"
            onClick={() => setIsRenaming(true)}
          >
            {t`Rename`}
          </Button>
          <Button
            type="button"
            onClick={() => void navigate({ to: '/library' })}
          >
            {t`Add tracks`}
          </Button>
          <div
            aria-label="歌单管理"
            role="group"
            {...stylex.props(styles.managementActions)}
          >
            {playlistTracks.length > 0 && (
              <ButtonIcon
                icon="trash"
                iconSize={16}
                label={t`Clear playlist`}
                onClick={() => clearPlaylist()}
                xstyle={styles.destructiveAction}
              />
            )}
            <Button
              type="button"
              onClick={() => void navigate({ to: '/settings/library' })}
            >
              {t`Import from folders`}
            </Button>
            <Button
              type="button"
              onClick={() => void DatabaseBridge.exportPlaylist(playlistID)}
            >
              {t`Export`}
            </Button>
            <ButtonIcon
              icon="trash"
              iconSize={16}
              label={t`Delete playlist`}
              onClick={() => deletePlaylist()}
              xstyle={styles.destructiveAction}
            />
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
            <button
              aria-disabled="true"
              aria-label="分享歌单，服务接入后可用"
              disabled
              title="分享歌单：服务接入后可用"
              type="button"
              {...stylex.props(styles.disabledServiceAction)}
            >
              分享
            </button>
          </div>
        </div>
      </section>
      {isRenaming && (
        <form
          aria-label="重命名播放列表"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            setIsRenaming(false);
            requestAnimationFrame(() =>
              document.getElementById('rename-playlist-trigger')?.focus(),
            );
          }}
          onSubmit={renamePlaylist}
          {...stylex.props(styles.renameForm)}
        >
          <label htmlFor="playlist-name" {...stylex.props(styles.renameLabel)}>
            {t`Playlist name`}
          </label>
          <input
            id="playlist-name"
            ref={renameInputRef}
            value={playlistName}
            onChange={(event) => setPlaylistName(event.currentTarget.value)}
            {...stylex.props(styles.renameInput)}
          />
          <Button type="submit">{t`Save`}</Button>
          <Button
            type="button"
            onClick={() => {
              setIsRenaming(false);
              requestAnimationFrame(() =>
                document.getElementById('rename-playlist-trigger')?.focus(),
              );
            }}
          >
            {t`Cancel`}
          </Button>
        </form>
      )}
      <section
        aria-labelledby="playlist-track-list-title"
        data-testid="playlist-detail-tracks"
        {...stylex.props(styles.tracksSection)}
      >
        <header {...stylex.props(styles.tracksHeader)}>
          <div>
            <h2
              id="playlist-track-list-title"
              {...stylex.props(styles.sectionTitle)}
            >
              歌曲列表（{playlistTracks.length}）
            </h2>
          </div>
          <div
            aria-label="歌单曲目工具栏"
            {...stylex.props(styles.tracksToolbar)}
          >
            <span {...stylex.props(styles.trackCount)}>
              {playlistTracks.length} 首
            </span>
            <label {...stylex.props(styles.searchLabel)}>
              <Icon name="search" size={16} />
              <input
                aria-label="搜索歌单歌曲"
                value={search}
                onChange={(event) =>
                  LibraryAPI.search(event.currentTarget.value)
                }
                placeholder="搜索歌曲…"
                {...stylex.props(styles.searchInput)}
              />
            </label>
          </div>
        </header>
        {body}
      </section>
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: 'min(1200px, 100%)',
    marginInline: 'auto',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '30px',
  },
  hero: {
    minWidth: 0,
    minHeight: '260px',
    padding: 0,
    display: 'grid',
    gridTemplateColumns: {
      default: '260px minmax(0, 1fr)',
      '@media (max-width: 999px)': '190px minmax(0, 1fr)',
      '@media (max-width: 599px)': '1fr',
    },
    alignItems: 'center',
    columnGap: '26px',
    rowGap: '12px',
  },
  artwork: {
    width: '260px',
    height: '260px',
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: 'var(--accent)',
    borderRadius: '10px',
    backgroundColor: 'var(--surface-sunken)',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
  },
  emptyArtwork: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-raised)',
  },
  artworkBadge: {
    position: 'absolute',
    right: '8px',
    bottom: '8px',
    paddingBlock: '4px',
    paddingInline: '7px',
    color: 'var(--accent)',
    borderRadius: '5px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: '0 3px 10px rgba(23, 34, 56, 0.12)',
    fontSize: '11px',
    fontWeight: 750,
  },
  heroCopy: {
    minWidth: 0,
    alignSelf: 'stretch',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  eyebrow: {
    display: 'block',
    marginBottom: '5px',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 750,
    letterSpacing: '0.08em',
  },
  title: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
    fontSize: {
      default: '30px',
      '@media (max-width: 699px)': '25px',
    },
    fontWeight: 800,
    lineHeight: 1.18,
  },
  description: {
    marginTop: '8px',
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  importPath: {
    marginTop: '6px',
    marginBottom: 0,
    overflow: 'hidden',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: 1.4,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stats: {
    width: 'min(560px, 100%)',
    marginTop: '14px',
    marginBottom: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: '16px',
    rowGap: '6px',
  },
  stat: {
    minWidth: 0,
    display: 'inline-flex',
    alignItems: 'baseline',
    columnGap: '5px',
  },
  statLabel: {
    display: 'inline',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    lineHeight: 1.3,
  },
  statValue: {
    display: 'inline',
    marginTop: 0,
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    minWidth: 0,
    gridColumnStart: '2',
    alignSelf: 'start',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
  playAllAction: {
    minHeight: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '7px',
    paddingBlock: '8px',
    paddingInline: '13px',
    color: 'var(--accent-contrast)',
    borderWidth: 0,
    borderRadius: '6px',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 6px 14px rgba(48, 34, 45, 0.18)',
    cursor: 'pointer',
  },
  secondaryIconAction: {
    width: '36px',
    height: '36px',
    color: 'var(--accent)',
    borderRadius: '6px',
    backgroundColor: 'var(--surface-selected)',
  },
  disabledServiceAction: {
    minHeight: '36px',
    paddingInline: '10px',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    fontSize: '12px',
  },
  managementActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    paddingLeft: '10px',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--border-subtle)',
  },
  renameForm: {
    padding: '16px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '13px',
    backgroundColor: 'var(--surface-raised)',
  },
  renameLabel: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 600,
  },
  renameInput: {
    minWidth: 'min(280px, 100%)',
    flexGrow: 1,
    minHeight: '32px',
    paddingBlock: '5px',
    paddingInline: '8px',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface-raised)',
  },
  tracksSection: {
    minWidth: 0,
  },
  tracksHeader: {
    marginBottom: '18px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '16px',
    rowGap: '10px',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '27px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  tracksToolbar: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '10px',
  },
  trackCount: {
    flexShrink: 0,
    paddingBlock: '7px',
    paddingInline: '10px',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    backgroundColor: 'var(--surface-sunken)',
    fontSize: '12px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  searchLabel: {
    minWidth: 'min(238px, 100%)',
    minHeight: '38px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
    paddingInline: '11px',
    color: 'var(--text-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-raised)',
  },
  searchInput: {
    minWidth: 0,
    width: '100%',
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '13px',
  },
  destructiveAction: {
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--danger-color)',
    },
  },
});
