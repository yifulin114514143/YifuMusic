import { Plural, useLingui } from '@lingui/react/macro';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import ContentHeader from '../components/ContentHeader';
import TrackList from '../components/TrackList';
import TrackListStates from '../components/TrackListStates';
import Link from '../elements/Link';
import View from '../elements/View';
import useFilteredTracks from '../hooks/useFilteredTracks';
import { parseDuration } from '../hooks/useFormattedDuration';
import useGlobalTrackListStatus, {
  useTrackListStatus,
} from '../hooks/useGlobalTrackListStatus';
import DatabaseBridge from '../lib/bridge-database';
import { allTracksQuery, configQuery } from '../lib/queries';
import queryClient from '../lib/query-client';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };

export const Route = createFileRoute('/library')({
  component: ViewLibrary,
  loader: async () => {
    const [_, playlists] = await Promise.all([
      queryClient.prefetchQuery(allTracksQuery),
      DatabaseBridge.getAllPlaylists(),
    ]);

    return { playlists };
  },
});

function ViewLibrary() {
  const { playlists } = Route.useLoaderData();
  const { t } = useLingui();

  const config = useSuspenseQuery(configQuery).data;

  // Some queries when switching routes can be expensive-ish (like getting all tracks),
  // while at the same time, the data will most of the time never change.
  // Using stale-while-revalidate libraries help us (fake-)loading this page faster
  const { data: tracks, isLoading } = useQuery(allTracksQuery);
  const allTracks = tracks ?? [];

  const filteredTracks = useFilteredTracks(
    allTracks,
    config.library_sort_by,
    config.library_sort_order,
  );
  useGlobalTrackListStatus(filteredTracks);
  const libraryStatus = useTrackListStatus(allTracks);

  return (
    <View>
      <ContentHeader
        title={t`Library`}
        description={t`Local music`}
        meta={
          <>
            <Plural
              value={libraryStatus.count}
              one="# track"
              other="# tracks"
            />
            {' / '}
            {parseDuration(libraryStatus.duration)}
          </>
        }
        actions={
          <Link linkOptions={{ to: '/settings/library' }}>
            {t`Library settings`}
          </Link>
        }
      />
      <TrackListStates isLoading={isLoading} tracks={filteredTracks}>
        <TrackList
          layout="default"
          data={filteredTracks}
          queueOrigin={QUEUE_ORIGIN}
          tracksDensity={config.track_view_density}
          playlists={playlists}
        />
      </TrackListStates>
    </View>
  );
}
