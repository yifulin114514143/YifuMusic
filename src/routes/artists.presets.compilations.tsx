import { Plural, useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo } from 'react';

import ContentHeader from '../components/ContentHeader';
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

export const Route = createFileRoute('/artists/presets/compilations')({
  component: ViewCompilations,
  validateSearch: validateFocusedAlbumSearch,
  loader: async () => {
    const [albums, playlists] = await Promise.all([
      DatabaseBridge.getCompilationAlbums(),
      DatabaseBridge.getAllPlaylists(),
    ]);

    return { albums, playlists };
  },
});

function ViewCompilations() {
  const { albums, playlists } = Route.useLoaderData();
  const config = useSuspenseQuery(configQuery).data;
  const { t } = useLingui();
  const router = useRouter();
  const content = useFilteredTrackGroup(albums);
  useGlobalTrackListStatus(content);

  const compilationTracks = useMemo(
    () => albums.flatMap((album) => album.tracks),
    [albums],
  );
  const compilationDuration = useMemo(
    () => compilationTracks.reduce((total, track) => total + track.duration, 0),
    [compilationTracks],
  );

  const queueOrigin = useMemo(() => {
    return { type: 'compilations' } satisfies QueueOrigin;
  }, []);

  useFocusedAlbum(Route.useSearch().focused_album);

  return (
    <>
      <ContentHeader
        title={t`Compilations`}
        description={t`Local compilation collection`}
        meta={
          <>
            <Plural value={albums.length} one="# album" other="# albums" />
            {' / '}
            <Plural
              value={compilationTracks.length}
              one="# track"
              other="# tracks"
            />
            {' / '}
            {parseDuration(compilationDuration)}
          </>
        }
        actions={
          <>
            <Button type="button" onClick={() => router.history.back()}>
              {t`Back`}
            </Button>
            {compilationTracks.length > 0 && (
              <>
                <ButtonIcon
                  icon="play"
                  label={t`Play all`}
                  onClick={() =>
                    void player.start(compilationTracks, null, queueOrigin)
                  }
                />
                <ButtonIcon
                  icon="list"
                  label={t`Add all to queue`}
                  onClick={() => player.addToQueue(compilationTracks)}
                />
              </>
            )}
          </>
        }
      />
      <TrackListStates isLoading={false} tracks={content}>
        <TrackList
          layout="grouped"
          data={content}
          tracksDensity={config.track_view_density}
          playlists={playlists}
          queueOrigin={queueOrigin}
          showArtistInTitle={true}
        />
      </TrackListStates>
    </>
  );
}
