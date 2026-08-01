import { Plural, Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import {
  Link as RouterLink,
  createFileRoute,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import { useMemo } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import ContentHeader from '../components/ContentHeader';
import Icon from '../components/Icon';
import SideNav from '../components/SideNav';
import SideNavLink from '../components/SideNavLink';
import Link from '../elements/Link';
import View from '../elements/View';
import * as ViewMessage from '../elements/ViewMessage';
import type { Track } from '../generated/typings';
import { parseDuration } from '../hooks/useFormattedDuration';
import DatabaseBridge from '../lib/bridge-database';
import { allTracksQuery } from '../lib/queries';
import useLibraryStore from '../lib/store';
import { stripAccents } from '../lib/utils-library';

const EMPTY_TRACKS: Track[] = [];
const artistOnlineActions = [
  '关注歌手',
  '歌手粉丝',
  '远程专辑',
  'MV',
  '分享',
] as const;

type ArtistSummary = {
  name: string;
  tracks: Track[];
  albums: number;
  duration: number;
};

export const Route = createFileRoute('/artists')({
  component: ViewArtists,
  loader: async () => {
    const [artists, hasCompilations] = await Promise.all([
      DatabaseBridge.getAllArtists(),
      DatabaseBridge.hasCompilations(),
    ]);

    return { artists, hasCompilations };
  },
});

function ViewArtists() {
  const { artists, hasCompilations } = Route.useLoaderData();
  const { pathname } = useLocation();
  const { t } = useLingui();
  const search = useLibraryStore((state) => state.search);
  const {
    data: tracks,
    isError: isTracksError,
    isLoading: isTracksLoading,
  } = useQuery(allTracksQuery);
  const allTracks = tracks ?? EMPTY_TRACKS;
  const normalizedSearch = stripAccents(search);

  const artistNames = useMemo(() => {
    if (artists.length > 0) return artists;

    return Array.from(new Set(allTracks.flatMap((track) => track.artists)));
  }, [allTracks, artists]);

  const artistSummaries = useMemo(() => {
    return artistNames.map((name) => {
      const artistTracks = allTracks.filter((track) =>
        track.artists.includes(name),
      );

      return {
        name,
        tracks: artistTracks,
        albums: new Set(
          artistTracks
            .map((track) => track.album)
            .filter((album) => album.trim().length > 0),
        ).size,
        duration: artistTracks.reduce(
          (total, track) => total + track.duration,
          0,
        ),
      } satisfies ArtistSummary;
    });
  }, [allTracks, artistNames]);

  const filteredArtists = useMemo(
    () =>
      artistSummaries.filter((artist) =>
        stripAccents(artist.name).includes(normalizedSearch),
      ),
    [artistSummaries, normalizedSearch],
  );
  const hasNoArtistSearchResults =
    artistNames.length > 0 && search.length > 0 && filteredArtists.length === 0;

  if (pathname === '/artists') {
    return (
      <View xstyle={styles.page}>
        <ContentHeader
          title="歌手"
          description="按已导入的本地音乐元数据整理"
          meta={`${filteredArtists.length} 位本地歌手`}
        />

        <section
          aria-label="歌手服务状态"
          data-testid="artist-service-actions"
          {...stylex.props(styles.serviceActions)}
        >
          <span {...stylex.props(styles.serviceCopy)}>
            仅展示本地歌手；在线服务接入后可用
          </span>
          {artistOnlineActions.map((label) => (
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

        {isTracksLoading ? (
          <div role="status" {...stylex.props(styles.statePanel)}>
            正在读取本地歌手...
          </div>
        ) : isTracksError ? (
          <div
            role="alert"
            {...stylex.props(styles.statePanel, styles.errorPanel)}
          >
            无法读取本地歌手，请稍后重试。
          </div>
        ) : filteredArtists.length > 0 ? (
          <section
            aria-label="本地歌手"
            data-reference-layout="moekoe-artist-grid"
            {...stylex.props(styles.grid)}
          >
            {filteredArtists.map((artist) => (
              <RouterLink
                key={artist.name}
                aria-label={`打开歌手 ${artist.name}`}
                to="/artists/$artistID"
                params={{ artistID: artist.name }}
                draggable={false}
                data-museeks-action
                {...stylex.props(styles.card)}
              >
                <span aria-hidden="true" {...stylex.props(styles.cardArt)}>
                  <Icon name="microphone" size={28} />
                </span>
                <span {...stylex.props(styles.cardCopy)}>
                  <strong
                    title={artist.name}
                    {...stylex.props(styles.cardName)}
                  >
                    {artist.name}
                  </strong>
                  <span {...stylex.props(styles.cardPrimaryMeta)}>
                    {artist.tracks.length} 首本地歌曲
                  </span>
                  <span {...stylex.props(styles.cardSecondaryMeta)}>
                    {artist.albums} 张专辑 · {parseDuration(artist.duration)}
                  </span>
                </span>
              </RouterLink>
            ))}
          </section>
        ) : hasNoArtistSearchResults ? (
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
        ) : (
          <ViewMessage.Notice>
            <p>音乐库中还没有可显示的歌手。</p>
            <ViewMessage.Sub>
              扫描本地曲目后会自动按歌手元数据整理。
            </ViewMessage.Sub>
          </ViewMessage.Notice>
        )}
      </View>
    );
  }

  return (
    <View
      sideNav={
        <SideNav
          title={t`Artists`}
          actions={
            <span title={t`Artist count`}>
              <Plural
                value={artistNames.length}
                one="# artist"
                other="# artists"
              />
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
              key={artist.name}
              id={artist.name}
              label={artist.name}
              linkOptions={{
                to: '/artists/$artistID',
                params: { artistID: artist.name },
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
      ) : (
        <Outlet />
      )}
    </View>
  );
}

const styles = stylex.create({
  page: {
    width: 'min(1200px, 100%)',
    marginInline: 'auto',
    padding: {
      default: '30px 20px',
      '@media (max-width: 699px)': '20px 14px',
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(auto-fill, minmax(190px, 1fr))',
      '@media (max-width: 699px)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: '16px',
    columnGap: '16px',
  },
  serviceActions: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    padding: '12px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    fontSize: '12px',
  },
  serviceCopy: {
    marginRight: '4px',
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
  statePanel: {
    minHeight: '200px',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
  },
  errorPanel: {
    color: 'var(--danger-color)',
  },
  card: {
    minWidth: 0,
    minHeight: '176px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px',
    color: 'var(--text-primary)',
    textDecorationLine: 'none',
    backgroundColor: {
      default: 'var(--surface-raised)',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'var(--border-subtle)',
      ':hover': 'var(--accent-border)',
    },
    borderRadius: 'var(--radius-md)',
    boxShadow: {
      default: '0 6px 18px rgba(21, 37, 51, 0.07)',
      ':hover': '0 14px 28px rgba(21, 37, 51, 0.16)',
    },
    transform: {
      ':hover': 'translateY(-3px)',
    },
    transition: {
      default: 'transform 180ms ease-out, box-shadow 180ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  cardArt: {
    width: '68px',
    height: '68px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
    borderRadius: '999px',
  },
  cardCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
  },
  cardName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '16px',
  },
  cardPrimaryMeta: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  cardSecondaryMeta: {
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
  },
});
