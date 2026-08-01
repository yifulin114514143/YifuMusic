import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
} from 'react';

import LibraryAPI from '../api/LibraryAPI';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import TrackList from '../components/TrackList';
import View from '../elements/View';
import type { Playlist, Track } from '../generated/typings';
import { parseDuration } from '../hooks/useFormattedDuration';
import DatabaseBridge from '../lib/bridge-database';
import { allTracksQuery, configQuery } from '../lib/queries';
import queryClient from '../lib/query-client';
import useLibraryStore from '../lib/store';
import {
  filterTracks,
  getSortOrder,
  sortTracks,
  stripAccents,
} from '../lib/utils-library';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };
const EMPTY_TRACKS: Track[] = [];
const searchTypes = [
  'complex',
  'song',
  'special',
  'album',
  'mv',
  'author',
] as const;

type SearchType = (typeof searchTypes)[number];
type SearchParams = {
  q?: string;
  type?: SearchType;
};

type LocalAlbum = {
  name: string;
  artist: string;
  tracks: Track[];
  duration: number;
  isCompilation: boolean;
};

const tabLabels: Record<SearchType, string> = {
  complex: '综合',
  song: '单曲',
  special: '歌单',
  album: '专辑',
  mv: 'MV',
  author: '歌手',
};
let pendingTabFocusType: SearchType | null = null;

export const Route = createFileRoute('/search')({
  component: ViewSearch,
  validateSearch: (search): SearchParams => {
    const q = typeof search?.q === 'string' ? search.q.trim() : undefined;
    const type = searchTypes.includes(search?.type as SearchType)
      ? (search.type as SearchType)
      : undefined;

    return {
      ...(q ? { q } : {}),
      ...(type ? { type } : {}),
    };
  },
  loader: async () => {
    const [_, playlists, artists] = await Promise.all([
      queryClient.prefetchQuery(allTracksQuery),
      DatabaseBridge.getAllPlaylists(),
      DatabaseBridge.getAllArtists(),
    ]);

    return { playlists, artists };
  },
});

function ViewSearch() {
  const { playlists, artists } = Route.useLoaderData();
  const { q, type } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = useLibraryStore((state) => state.search);
  const config = useSuspenseQuery(configQuery).data;
  const { data: tracks, isLoading, isError } = useQuery(allTracksQuery);
  const allTracks = tracks ?? EMPTY_TRACKS;
  const query = search.trim();
  const normalizedQuery = stripAccents(query);
  const activeType = type ?? 'complex';

  useEffect(() => {
    LibraryAPI.search(q ?? '');
  }, [q]);

  useEffect(() => {
    if (pendingTabFocusType !== activeType) return;

    pendingTabFocusType = null;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`search-tab-${activeType}`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeType]);

  const matchingTracks = useMemo(
    () =>
      sortTracks(
        filterTracks(allTracks, normalizedQuery),
        getSortOrder(config.library_sort_by),
        config.library_sort_order,
      ),
    [
      allTracks,
      config.library_sort_by,
      config.library_sort_order,
      normalizedQuery,
    ],
  );

  const localArtistNames = useMemo(() => {
    if (artists.length > 0) return artists;

    return Array.from(new Set(allTracks.flatMap((track) => track.artists)));
  }, [allTracks, artists]);

  const matchingArtists = useMemo(
    () =>
      localArtistNames.filter((artist) =>
        matchesQuery(artist, normalizedQuery),
      ),
    [localArtistNames, normalizedQuery],
  );

  const matchingAlbums = useMemo(
    () =>
      collectLocalAlbums(allTracks).filter(
        (album) =>
          matchesQuery(album.name, normalizedQuery) ||
          matchesQuery(album.artist, normalizedQuery),
      ),
    [allTracks, normalizedQuery],
  );

  const matchingPlaylists = useMemo(
    () =>
      playlists.filter((playlist) =>
        matchesQuery(playlist.name, normalizedQuery),
      ),
    [normalizedQuery, playlists],
  );

  const selectTab = (nextType: SearchType) => {
    void navigate({
      search: {
        ...(query ? { q: query } : {}),
        ...(nextType === 'complex' ? {} : { type: nextType }),
      },
      replace: true,
    });
  };

  const onTabsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const supportedKeys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!supportedKeys.includes(event.key)) return;

    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const currentIndex = tabs.findIndex(
      (tab) => tab === document.activeElement,
    );
    if (currentIndex < 0 || tabs.length === 0) return;

    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex +
              (event.key === 'ArrowRight' ? 1 : -1) +
              tabs.length) %
            tabs.length;
    const nextType = searchTypes[nextIndex];
    if (nextType === undefined) return;

    pendingTabFocusType = nextType;
    selectTab(nextType);
  };

  const hasComplexResults =
    matchingTracks.length > 0 ||
    matchingArtists.length > 0 ||
    matchingAlbums.length > 0 ||
    matchingPlaylists.length > 0;

  return (
    <View xstyle={styles.page}>
      <header {...stylex.props(styles.header)}>
        <h2 {...stylex.props(styles.pageTitle)}>搜索结果</h2>
        {query.length > 0 && (
          <p {...stylex.props(styles.searchSummary)}>
            正在本地音乐中搜索“{query}”
          </p>
        )}
      </header>

      <div
        aria-label="搜索分类"
        role="tablist"
        tabIndex={0}
        onKeyDown={onTabsKeyDown}
        {...stylex.props(styles.tabs)}
      >
        {searchTypes.map((searchType) => (
          <button
            key={searchType}
            aria-controls={`search-panel-${searchType}`}
            aria-selected={activeType === searchType}
            id={`search-tab-${searchType}`}
            role="tab"
            type="button"
            onClick={() => selectTab(searchType)}
            {...stylex.props(
              styles.tab,
              activeType === searchType && styles.tabActive,
            )}
          >
            {tabLabels[searchType]}
          </button>
        ))}
      </div>

      <section
        aria-label={`${tabLabels[activeType]}搜索结果`}
        id={`search-panel-${activeType}`}
        role="tabpanel"
        {...stylex.props(styles.panel)}
      >
        {isLoading ? (
          <SearchState message="正在读取本地音乐库…" />
        ) : isError ? (
          <SearchState message="读取本地音乐库失败，请稍后重试。" />
        ) : query.length === 0 ? (
          <SearchState message="输入关键词后，即可查看本地搜索结果。" />
        ) : activeType === 'mv' ? (
          <SearchState
            message="MV 搜索将在服务接入后可用；当前不会显示虚构结果。"
            unavailableLabel="在线 MV 搜索服务接入后可用"
          />
        ) : activeType === 'complex' ? (
          hasComplexResults ? (
            <div {...stylex.props(styles.complexResults)}>
              {matchingArtists.length > 0 && (
                <SearchSection title={`歌手（${matchingArtists.length}）`}>
                  <div {...stylex.props(styles.resultGrid)}>
                    {matchingArtists.map((artist) => (
                      <ArtistResultCard key={artist} artist={artist} />
                    ))}
                  </div>
                </SearchSection>
              )}
              {matchingTracks.length > 0 && (
                <SearchSection title={`单曲（${matchingTracks.length}）`}>
                  <TrackList
                    layout="default"
                    data={matchingTracks}
                    queueOrigin={QUEUE_ORIGIN}
                    tracksDensity={config.track_view_density}
                    playlists={playlists}
                  />
                </SearchSection>
              )}
              {matchingAlbums.length > 0 && (
                <SearchSection title={`专辑（${matchingAlbums.length}）`}>
                  <div {...stylex.props(styles.resultGrid)}>
                    {matchingAlbums.map((album) => (
                      <AlbumResultCard key={album.key} album={album} />
                    ))}
                  </div>
                </SearchSection>
              )}
              {matchingPlaylists.length > 0 && (
                <SearchSection title={`歌单（${matchingPlaylists.length}）`}>
                  <div {...stylex.props(styles.resultGrid)}>
                    {matchingPlaylists.map((playlist) => (
                      <PlaylistResultCard
                        key={playlist.id}
                        playlist={playlist}
                      />
                    ))}
                  </div>
                </SearchSection>
              )}
            </div>
          ) : (
            <SearchState message={`本地音乐中没有与“${query}”匹配的结果。`} />
          )
        ) : activeType === 'song' ? (
          matchingTracks.length > 0 ? (
            <TrackList
              layout="default"
              data={matchingTracks}
              queueOrigin={QUEUE_ORIGIN}
              tracksDensity={config.track_view_density}
              playlists={playlists}
            />
          ) : (
            <SearchState message={`本地单曲中没有与“${query}”匹配的结果。`} />
          )
        ) : activeType === 'author' ? (
          matchingArtists.length > 0 ? (
            <div {...stylex.props(styles.resultGrid)}>
              {matchingArtists.map((artist) => (
                <ArtistResultCard key={artist} artist={artist} />
              ))}
            </div>
          ) : (
            <SearchState message={`本地歌手中没有与“${query}”匹配的结果。`} />
          )
        ) : activeType === 'album' ? (
          matchingAlbums.length > 0 ? (
            <div {...stylex.props(styles.resultGrid)}>
              {matchingAlbums.map((album) => (
                <AlbumResultCard key={album.key} album={album} />
              ))}
            </div>
          ) : (
            <SearchState message={`本地专辑中没有与“${query}”匹配的结果。`} />
          )
        ) : matchingPlaylists.length > 0 ? (
          <div {...stylex.props(styles.resultGrid)}>
            {matchingPlaylists.map((playlist) => (
              <PlaylistResultCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        ) : (
          <SearchState message={`本地歌单中没有与“${query}”匹配的结果。`} />
        )}
      </section>
    </View>
  );
}

function matchesQuery(value: string, normalizedQuery: string): boolean {
  return (
    normalizedQuery.length > 0 && stripAccents(value).includes(normalizedQuery)
  );
}

function collectLocalAlbums(
  tracks: Track[],
): Array<LocalAlbum & { key: string }> {
  const albums = new Map<string, LocalAlbum & { key: string }>();

  for (const track of tracks) {
    if (track.album.trim().length === 0) continue;

    const key = [track.album, track.album_artist, track.is_compilation].join(
      '\u0000',
    );
    const current = albums.get(key);

    if (current !== undefined) {
      current.tracks.push(track);
      current.duration += track.duration;
      continue;
    }

    albums.set(key, {
      key,
      name: track.album,
      artist: track.album_artist,
      tracks: [track],
      duration: track.duration,
      isCompilation: track.is_compilation,
    });
  }

  return Array.from(albums.values());
}

function SearchSection(props: { title: string; children: React.ReactNode }) {
  const { title, children } = props;

  return (
    <section aria-label={title} {...stylex.props(styles.section)}>
      <h3 {...stylex.props(styles.sectionTitle)}>{title}</h3>
      {children}
    </section>
  );
}

function SearchState({
  message,
  unavailableLabel,
}: {
  message: string;
  unavailableLabel?: string;
}) {
  return (
    <div role="status" {...stylex.props(styles.state)}>
      <span>{message}</span>
      {unavailableLabel !== undefined && (
        <button
          aria-label={unavailableLabel}
          disabled
          title="服务接入后可用"
          type="button"
          {...stylex.props(styles.unavailableAction)}
        >
          在线 MV 搜索
        </button>
      )}
    </div>
  );
}

function ArtistResultCard({ artist }: { artist: string }) {
  return (
    <Link
      aria-label={`打开歌手 ${artist}`}
      to="/artists/$artistID"
      params={{ artistID: artist }}
      draggable={false}
      data-museeks-action
      {...stylex.props(styles.resultCard)}
    >
      <span {...stylex.props(styles.cardIcon)}>
        <Icon name="microphone" size={24} />
      </span>
      <span {...stylex.props(styles.cardText)}>
        <strong title={artist} {...stylex.props(styles.cardTitle)}>
          {artist}
        </strong>
        <small>本地歌手</small>
      </span>
    </Link>
  );
}

function AlbumResultCard({ album }: { album: LocalAlbum & { key: string } }) {
  const card = (
    <>
      <span {...stylex.props(styles.albumCover)}>
        {album.tracks[0] !== undefined ? (
          <Cover track={album.tracks[0]} iconSize={24} />
        ) : (
          <Icon name="musicalNotes" size={24} />
        )}
      </span>
      <span {...stylex.props(styles.cardText, styles.albumCardText)}>
        <strong title={album.name} {...stylex.props(styles.cardTitle)}>
          {album.name}
        </strong>
        <small title={album.artist}>
          {album.artist || '本地专辑'} · {album.tracks.length} 首 ·{' '}
          {parseDuration(album.duration)}
        </small>
      </span>
    </>
  );

  if (album.isCompilation) {
    return (
      <Link
        aria-label={`打开专辑 ${album.name}`}
        to="/artists/presets/compilations"
        search={{ focused_album: album.name }}
        draggable={false}
        data-museeks-action
        {...stylex.props(styles.resultCard, styles.albumCard)}
      >
        {card}
      </Link>
    );
  }

  if (album.artist.length > 0) {
    return (
      <Link
        aria-label={`打开专辑 ${album.name}`}
        to="/artists/$artistID"
        params={{ artistID: album.artist }}
        search={{ focused_album: album.name }}
        draggable={false}
        data-museeks-action
        {...stylex.props(styles.resultCard, styles.albumCard)}
      >
        {card}
      </Link>
    );
  }

  return (
    <div {...stylex.props(styles.resultCard, styles.albumCard)}>{card}</div>
  );
}

function PlaylistResultCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      aria-label={`打开歌单 ${playlist.name}`}
      to="/playlists/$playlistID"
      params={{ playlistID: playlist.id }}
      draggable={false}
      data-museeks-action
      {...stylex.props(styles.resultCard)}
    >
      <span {...stylex.props(styles.cardIcon)}>
        <Icon name="playlist" size={24} />
      </span>
      <span {...stylex.props(styles.cardText)}>
        <strong title={playlist.name} {...stylex.props(styles.cardTitle)}>
          {playlist.name}
        </strong>
        <small>{playlist.tracks.length} 首本地歌曲</small>
      </span>
    </Link>
  );
}

const styles = stylex.create({
  page: {
    width: 'min(1400px, 100%)',
    marginInline: 'auto',
    padding: {
      default: '20px',
      '@media (max-width: 699px)': '20px 14px',
    },
    display: 'flex',
    flexDirection: 'column',
    rowGap: '20px',
  },
  header: {
    minWidth: 0,
    paddingBottom: '4px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '20px',
    rowGap: '12px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '30px',
    fontWeight: 800,
  },
  searchSummary: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  tabs: {
    display: 'flex',
    alignItems: 'center',
    columnGap: {
      default: '30px',
      '@media (max-width: 699px)': '18px',
    },
    paddingBottom: 0,
    overflowX: 'auto',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  tab: {
    minHeight: '42px',
    flexShrink: 0,
    paddingBlock: '10px',
    paddingInline: 0,
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '3px',
    borderLeftWidth: '0',
    borderColor: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '16px',
    fontWeight: 600,
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
  },
  panel: {
    minWidth: 0,
  },
  complexResults: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '34px',
  },
  section: {
    minWidth: 0,
  },
  sectionTitle: {
    marginBlock: 0,
    marginBottom: '18px',
    color: 'var(--accent)',
    fontSize: '20px',
    fontWeight: 800,
  },
  resultGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(auto-fill, minmax(190px, 1fr))',
      '@media (max-width: 599px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 399px)': '1fr',
    },
    rowGap: '20px',
    columnGap: '20px',
  },
  resultCard: {
    minWidth: 0,
    minHeight: '84px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    columnGap: '12px',
    padding: '12px',
    color: 'var(--text-primary)',
    textDecorationLine: 'none',
    backgroundColor: {
      default: 'var(--surface-raised)',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    boxShadow: {
      default: '0 8px 18px rgba(36, 59, 89, 0.05)',
      ':hover': '0 15px 28px rgba(36, 59, 89, 0.14)',
    },
    transform: {
      ':hover': 'translateY(-2px)',
    },
    transition: 'transform 180ms ease, box-shadow 180ms ease',
  },
  albumCard: {
    minHeight: '252px',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    rowGap: '11px',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: '14px',
    paddingLeft: 0,
    overflow: 'hidden',
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    borderRadius: '12px',
  },
  albumCover: {
    width: '100%',
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-sunken)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  albumCardText: {
    paddingInline: '14px',
  },
  cardText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    overflow: 'hidden',
  },
  cardTitle: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '15px',
  },
  state: {
    minHeight: '250px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '12px',
    padding: '24px',
    boxSizing: 'border-box',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-strong)',
    borderRadius: '10px',
  },
  unavailableAction: {
    minHeight: '34px',
    paddingBlock: '6px',
    paddingInline: '12px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'not-allowed',
    opacity: 0.72,
  },
});
