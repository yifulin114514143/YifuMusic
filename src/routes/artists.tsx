import { Plural, Trans, useLingui } from '@lingui/react/macro';
import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from '@tanstack/react-router';
import { useMemo } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import SideNav from '../components/SideNav';
import SideNavLink from '../components/SideNavLink';
import Link from '../elements/Link';
import View from '../elements/View';
import * as ViewMessage from '../elements/ViewMessage';
import DatabaseBridge from '../lib/bridge-database';
import player from '../lib/player';
import useLibraryStore from '../lib/store';
import { stripAccents } from '../lib/utils-library';

export const Route = createFileRoute('/artists')({
  component: ViewArtists,
  beforeLoad: async ({ location }) => {
    const [artists, hasCompilations] = await Promise.all([
      DatabaseBridge.getAllArtists(),
      DatabaseBridge.hasCompilations(),
    ]);

    // Only redirect when landing on /artists with no child route selected
    if (location.pathname === '/artists') {
      const queueOrigin = player.getQueueOrigin();

      // If there is a playing artist, redirect to it
      if (queueOrigin?.type === 'artist' && artists.length > 0) {
        throw redirect({
          to: '/artists/$artistID',
          params: { artistID: queueOrigin.artistID },
        });
      }

      if (artists.length > 0) {
        throw redirect({
          to: '/artists/$artistID',
          params: { artistID: artists[0] },
        });
      }

      if (hasCompilations) {
        throw redirect({ to: '/artists/presets/compilations' });
      }
    }

    return { artists, hasCompilations };
  },
  loader: async ({ context }) => {
    return context;
  },
});

function ViewArtists() {
  const { artists, hasCompilations } = Route.useLoaderData();
  const { pathname } = useLocation();
  const { t } = useLingui();
  const search = useLibraryStore((state) => state.search);
  const filteredArtists = useMemo(() => {
    const normalizedSearch = stripAccents(search);

    return artists.filter((artist) =>
      stripAccents(artist).includes(normalizedSearch),
    );
  }, [artists, search]);
  const hasNoArtistSearchResults =
    artists.length > 0 && search.length > 0 && filteredArtists.length === 0;

  return (
    <View
      sideNav={
        <SideNav
          title={t`Artists`}
          actions={
            <span title={t`Artist count`}>
              <Plural value={artists.length} one="# artist" other="# artists" />
            </span>
          }
          bottomContent={
            hasCompilations && (
              <SideNavLink
                key="compilations"
                id="compilations"
                label={t`Compilations`}
                linkOptions={{ to: '/artists/presets/compilations' }}
              />
            )
          }
        >
          {filteredArtists.map((artist) => (
            <SideNavLink
              key={artist}
              id={artist}
              label={artist}
              linkOptions={{
                to: '/artists/$artistID',
                params: { artistID: artist },
              }}
            />
          ))}
        </SideNav>
      }
    >
      {hasNoArtistSearchResults ? (
        <ViewMessage.Notice>
          <p>
            <Trans>No artists found for "{search}"</Trans>
          </p>
          <ViewMessage.Sub>
            <Link onClick={() => LibraryAPI.search('')}>
              <Trans>Clear search</Trans>
            </Link>
          </ViewMessage.Sub>
        </ViewMessage.Notice>
      ) : pathname !== '/artists' ? (
        <Outlet />
      ) : (
        <ViewMessage.Notice>
          <p>
            <Trans>There are no artists in your library</Trans>
          </p>
          <ViewMessage.Sub>
            <Trans>Artists appear after local tracks are scanned.</Trans>
          </ViewMessage.Sub>
        </ViewMessage.Notice>
      )}
    </View>
  );
}
