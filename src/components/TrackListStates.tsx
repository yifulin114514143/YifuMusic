import { Trans } from '@lingui/react/macro';

import LibraryAPI from '../api/LibraryAPI';
import Link from '../elements/Link';
import * as ViewMessage from '../elements/ViewMessage';
import type { Track, TrackGroup } from '../generated/typings';
import useLibraryStore from '../lib/store';

type Props = {
  isLoading: boolean;
  tracks: Array<Track> | Array<TrackGroup>;
  children?: React.ReactNode;
};

export default function TrackListStates(props: Props) {
  const { isLoading, tracks, children } = props;

  const refreshing = useLibraryStore((state) => state.refreshing);
  const search = useLibraryStore((state) => state.search);

  // Refreshing library
  if (isLoading) {
    return (
      <ViewMessage.Notice>
        <p>
          <Trans>Loading library...</Trans>
        </p>
      </ViewMessage.Notice>
    );
  }

  // Refreshing library
  if (refreshing) {
    return (
      <ViewMessage.Notice>
        <p>
          <Trans>Your library is being scanned</Trans>
        </p>
        <ViewMessage.Sub>
          <Trans>hold on...</Trans>
        </ViewMessage.Sub>
      </ViewMessage.Notice>
    );
  }

  // Empty library
  if (tracks.length === 0 && search === '') {
    return (
      <ViewMessage.Notice>
        <p>
          <Trans>Your library is empty</Trans>
        </p>
        <ViewMessage.Sub>
          <Trans>
            Choose a local music folder in{' '}
            <Link linkOptions={{ to: '/settings/library' }}>
              library settings
            </Link>{' '}
            to scan it.
          </Trans>
        </ViewMessage.Sub>
      </ViewMessage.Notice>
    );
  }

  // Empty search
  if (tracks.length === 0) {
    return (
      <ViewMessage.Notice>
        <p>
          <Trans>No results for "{search}"</Trans>
        </p>
        <ViewMessage.Sub>
          <Link onClick={() => LibraryAPI.search('')}>
            <Trans>Clear search</Trans>
          </Link>
        </ViewMessage.Sub>
      </ViewMessage.Notice>
    );
  }

  return <>{children}</>;
}
