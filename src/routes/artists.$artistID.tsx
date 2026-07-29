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
      <ContentHeader
        title={artistID}
        description={t`Local artist collection`}
        meta={
          <>
            <Plural value={albums.length} one="# album" other="# albums" />
            {' / '}
            <Plural
              value={artistTracks.length}
              one="# track"
              other="# tracks"
            />
            {' / '}
            {parseDuration(artistDuration)}
          </>
        }
        actions={
          <>
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
                />
                <ButtonIcon
                  icon="list"
                  label={t`Add all to queue`}
                  onClick={() => player.addToQueue(artistTracks)}
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
        />
      </TrackListStates>
    </>
  );
}
