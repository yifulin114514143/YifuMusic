import { Plural, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

import Icon from '../components/Icon';
import TrackList from '../components/TrackList';
import TrackListStates from '../components/TrackListStates';
import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import { useFilteredTrackGroup } from '../hooks/useFilteredTracks';
import useFocusedAlbum, {
  validateFocusedAlbumSearch,
} from '../hooks/useFocusedAlbum';
import { parseDuration } from '../hooks/useFormattedDuration';
import useGlobalTrackListStatus from '../hooks/useGlobalTrackListStatus';
import DatabaseBridge from '../lib/bridge-database';
import player from '../lib/player';
import { configQuery } from '../lib/queries';
import type { QueueOrigin } from '../types/museeks';

export const Route = createFileRoute('/artists/$artistID')({
  component: ViewArtistDetails,
  loader: async ({ params }) => {
    const [albums, playlists] = await Promise.all([
      DatabaseBridge.getArtistTracks(params.artistID),
      DatabaseBridge.getAllPlaylists(),
    ]);

    return { albums, playlists };
  },
  validateSearch: validateFocusedAlbumSearch,
});

export default function ViewArtistDetails() {
  const { albums, playlists } = Route.useLoaderData();
  const config = useSuspenseQuery(configQuery).data;
  const { artistID } = Route.useParams();
  const { t } = useLingui();
  const router = useRouter();
  const content = useFilteredTrackGroup(albums);
  useGlobalTrackListStatus(content);

  const artistTracks = useMemo(
    () => albums.flatMap((album) => album.tracks),
    [albums],
  );
  const artistDuration = useMemo(
    () => artistTracks.reduce((total, track) => total + track.duration, 0),
    [artistTracks],
  );

  const queueOrigin = useMemo(() => {
    return { type: 'artist', artistID } satisfies QueueOrigin;
  }, [artistID]);

  useFocusedAlbum(Route.useSearch().focused_album);

  return (
    <>
      <section
        aria-label={`${artistID} 本地歌手资料`}
        data-reference-layout="moekoe-artist-detail"
        {...stylex.props(styles.hero)}
      >
        <span aria-hidden="true" {...stylex.props(styles.avatar)}>
          <Icon name="microphone" size={36} />
        </span>
        <div {...stylex.props(styles.copy)}>
          <span {...stylex.props(styles.eyebrow)}>本地歌手</span>
          <h2 {...stylex.props(styles.title)}>{artistID}</h2>
          <p {...stylex.props(styles.meta)}>
            <Plural value={albums.length} one="# album" other="# albums" />
            {' / '}
            <Plural
              value={artistTracks.length}
              one="# track"
              other="# tracks"
            />
            {' / '}
            {parseDuration(artistDuration)}
          </p>
        </div>
        <div {...stylex.props(styles.actions)}>
          <Button type="button" onClick={() => router.history.back()}>
            {t`Back`}
          </Button>
          {artistTracks.length > 0 && (
            <>
              <ButtonIcon
                icon="play"
                label={t`Play all`}
                onClick={() =>
                  void player.start(artistTracks, null, queueOrigin)
                }
                xstyle={styles.primaryAction}
              />
              <ButtonIcon
                icon="list"
                label={t`Add all to queue`}
                onClick={() => player.addToQueue(artistTracks)}
                xstyle={styles.secondaryAction}
              />
            </>
          )}
        </div>
      </section>
      <section
        aria-label="歌手在线服务状态"
        data-testid="artist-detail-service-actions"
        {...stylex.props(styles.serviceActions)}
      >
        <span>本页仅聚合已扫描的本地作品。</span>
        {['关注歌手', '歌手粉丝', '远程专辑', 'MV', '分享'].map((label) => (
          <button
            key={label}
            aria-disabled="true"
            aria-label={`${label}，服务接入后可用`}
            disabled
            title={`${label}：服务接入后可用`}
            type="button"
            {...stylex.props(styles.disabledServiceAction)}
          >
            {label}
          </button>
        ))}
      </section>
      <TrackListStates isLoading={false} tracks={content}>
        <TrackList
          layout="grouped"
          data={content}
          tracksDensity={config.track_view_density}
          playlists={playlists}
          queueOrigin={queueOrigin}
        />
      </TrackListStates>
    </>
  );
}

const styles = stylex.create({
  hero: {
    minWidth: 0,
    marginBottom: '18px',
    padding: {
      default: '22px',
      '@media (max-width: 699px)': '16px',
    },
    display: 'flex',
    alignItems: 'center',
    columnGap: '16px',
    rowGap: '14px',
    flexWrap: 'wrap',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 22px rgba(21, 37, 51, 0.08)',
  },
  avatar: {
    width: '82px',
    height: '82px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
    borderRadius: '999px',
  },
  copy: {
    minWidth: 0,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
  },
  eyebrow: {
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 700,
  },
  title: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
    fontSize: {
      default: '28px',
      '@media (max-width: 699px)': '24px',
    },
    lineHeight: 1.2,
  },
  meta: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
  },
  primaryAction: {
    width: '40px',
    height: '40px',
    color: 'var(--accent-contrast)',
    backgroundColor: 'var(--accent)',
    borderRadius: '999px',
  },
  secondaryAction: {
    width: '36px',
    height: '36px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-selected)',
    borderRadius: '999px',
  },
  serviceActions: {
    marginBottom: '18px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    fontSize: '12px',
  },
  disabledServiceAction: {
    minHeight: '30px',
    paddingInline: '9px',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '999px',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    fontSize: '12px',
  },
});
