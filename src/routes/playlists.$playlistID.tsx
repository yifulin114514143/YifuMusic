import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  redirect,
  useLoaderData,
  useNavigate,
} from '@tanstack/react-router';
import { ask } from '@tauri-apps/plugin-dialog';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PlaylistsAPI from '../api/PlaylistsAPI';
import ContentHeader from '../components/ContentHeader';
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
import { configQuery } from '../lib/queries';
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
  const { playlists } = useLoaderData({ from: '/playlists' });
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
    <>
      <ContentHeader
        title={playlist.name}
        description={t`Local playlist`}
        meta={t`${playlistTracks.length} tracks / ${parseDuration(playlistDuration)}`}
        actions={
          <>
            <Button type="button" onClick={() => setIsRenaming(true)}>
              {t`Rename`}
            </Button>
            {playlistTracks.length > 0 && (
              <>
                <ButtonIcon
                  icon="play"
                  label={t`Play all`}
                  onClick={() => void PlaylistsAPI.play(playlistID)}
                />
                <Button
                  type="button"
                  onClick={() => void navigate({ to: '/library' })}
                >
                  {t`Add tracks`}
                </Button>
                <ButtonIcon
                  icon="trash"
                  iconSize={16}
                  label={t`Clear playlist`}
                  onClick={() => clearPlaylist()}
                  xstyle={styles.destructiveAction}
                />
              </>
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
          </>
        }
      />
      {isRenaming && (
        <form onSubmit={renamePlaylist} {...stylex.props(styles.renameForm)}>
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
          <Button type="button" onClick={() => setIsRenaming(false)}>
            {t`Cancel`}
          </Button>
        </form>
      )}
      {body}
    </>
  );
}

const styles = stylex.create({
  renameForm: {
    paddingBlock: '12px',
    paddingInline: {
      default: '24px',
      '@media (max-width: 899px)': '16px',
    },
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
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
  destructiveAction: {
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--danger-color)',
    },
  },
});
