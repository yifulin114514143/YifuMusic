import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { open } from '@tauri-apps/plugin-dialog';
import {
  FolderPlus,
  HardDrive,
  LayoutGrid,
  ListChecks,
  ListPlus,
  LocateFixed,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import { useAppShell } from '../components/AppShellContext';
import BackToTop from '../components/BackToTop';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import View from '../elements/View';
import type { Track } from '../generated/typings';
import useFilteredTracks from '../hooks/useFilteredTracks';
import useInvalidate from '../hooks/useInvalidate';
import usePlayingTrackID from '../hooks/usePlayingTrackID';
import player from '../lib/player';
import { allTracksQuery, configQuery } from '../lib/queries';
import queryClient from '../lib/query-client';
import useLibraryStore from '../lib/store';
import toastManager from '../lib/toast-manager';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };
const LOCAL_MUSIC_VIEW_KEY = 'yifu-local-music-view';
const LOCAL_MUSIC_FOLDER_KEY = 'yifu-local-music-folder';
const LOCAL_MUSIC_FOLDER_HISTORY_KEY = 'yifu-local-music-folder-history';
const MAX_FOLDER_HISTORY = 10;
const EMPTY_TRACKS: Track[] = [];

type LocalMusicView = 'list' | 'grid';
type LocalSortKey = 'filename' | 'artist' | 'album' | 'duration' | 'quality';
type SortDirection = 'ascending' | 'descending';

export const Route = createFileRoute('/local-music')({
  component: ViewLocalMusic,
  loader: () => queryClient.prefetchQuery(allTracksQuery),
});

function getFolderName(folder: string): string {
  const parts = folder.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? folder;
}

function belongsToFolder(trackPath: string, folder: string): boolean {
  if (folder === '/' || folder === '\\') return trackPath.startsWith(folder);

  return (
    trackPath === folder ||
    trackPath.startsWith(`${folder}/`) ||
    trackPath.startsWith(`${folder}\\`)
  );
}

function getFileName(trackPath: string): string {
  const parts = trackPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? trackPath;
}

function getTrackFormat(track: Track): string {
  const fileName = getFileName(track.path);
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex === -1 || extensionIndex === fileName.length - 1) {
    return '未知格式';
  }

  return fileName.slice(extensionIndex + 1).toLocaleUpperCase();
}

function readFolderHistory(): string[] {
  try {
    const storedValue = window.localStorage.getItem(
      LOCAL_MUSIC_FOLDER_HISTORY_KEY,
    );
    if (storedValue === null) return [];

    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .filter(
        (folder): folder is string =>
          typeof folder === 'string' && folder !== '',
      )
      .slice(0, MAX_FOLDER_HISTORY);
  } catch {
    return [];
  }
}

function LocalMusicTrackList(props: {
  tracks: Track[];
  playbackTracks: Track[];
  sortKey: LocalSortKey;
  sortDirection: SortDirection;
  selectedTrackIDs: Set<string>;
  isBatchSelecting: boolean;
  allVisibleSelected: boolean;
  onSort: (key: LocalSortKey) => void;
  onToggleSelection: (trackID: string) => void;
  onToggleSelectAll: () => void;
}) {
  const {
    tracks,
    playbackTracks,
    sortKey,
    sortDirection,
    selectedTrackIDs,
    isBatchSelecting,
    allVisibleSelected,
    onSort,
    onToggleSelection,
    onToggleSelectAll,
  } = props;
  const playingTrackID = usePlayingTrackID();

  const getSortLabel = (key: LocalSortKey) => {
    const label =
      key === 'filename'
        ? '文件名'
        : key === 'artist'
          ? '歌手'
          : key === 'album'
            ? '专辑'
            : key === 'duration'
              ? '时长'
              : '文件格式';
    const direction =
      sortKey === key
        ? sortDirection === 'ascending'
          ? '升序'
          : '降序'
        : '未排序';

    return `按${label}排序，当前${direction}`;
  };

  return (
    <section
      aria-label="本地歌曲列表"
      data-testid="local-music-track-list"
      {...stylex.props(styles.localTrackTable)}
    >
      <div {...stylex.props(styles.localTrackHeader)}>
        <span {...stylex.props(styles.selectionCell)}>
          {isBatchSelecting && (
            <input
              aria-label={
                allVisibleSelected
                  ? '取消选择当前可见的全部歌曲'
                  : '选择当前可见的全部歌曲'
              }
              checked={allVisibleSelected}
              type="checkbox"
              onChange={onToggleSelectAll}
            />
          )}
        </span>
        <span>编号</span>
        {(['filename', 'artist', 'album', 'duration', 'quality'] as const).map(
          (key) => (
            <span key={key}>
              <button
                aria-label={getSortLabel(key)}
                data-sort-direction={
                  sortKey === key ? sortDirection : undefined
                }
                type="button"
                onClick={() => onSort(key)}
                {...stylex.props(
                  styles.sortButton,
                  sortKey === key && styles.sortButtonActive,
                )}
              >
                <span>
                  {key === 'filename'
                    ? '文件名'
                    : key === 'artist'
                      ? '歌手'
                      : key === 'album'
                        ? '专辑'
                        : key === 'duration'
                          ? '时长'
                          : '质量'}
                </span>
                {sortKey === key && (
                  <span aria-hidden="true">
                    {sortDirection === 'ascending' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            </span>
          ),
        )}
        <span>文件大小</span>
        <span>当前播放状态</span>
      </div>
      <div>
        {tracks.map((track, index) => {
          const isCurrentTrack = track.id === playingTrackID;
          const fileName = getFileName(track.path);
          const format = getTrackFormat(track);
          const playTrack = () =>
            player.start(playbackTracks, track.id, QUEUE_ORIGIN);

          return (
            <div
              key={track.id}
              aria-label={`播放 ${track.title}`}
              data-is-playing={isCurrentTrack || undefined}
              data-track-id={track.id}
              onClick={() => {
                if (!isBatchSelecting) {
                  void playTrack();
                }
              }}
              onKeyDown={(event) => {
                if (
                  isBatchSelecting ||
                  event.target !== event.currentTarget ||
                  (event.key !== 'Enter' && event.key !== ' ')
                ) {
                  return;
                }

                event.preventDefault();
                void playTrack();
              }}
              /* oxlint-disable-next-line jsx_a11y/prefer-tag-over-role -- the row has independent playback and batch-selection controls. */
              role="button"
              tabIndex={isBatchSelecting ? -1 : 0}
              {...stylex.props(
                styles.localTrackRow,
                isCurrentTrack && styles.localTrackRowPlaying,
                selectedTrackIDs.has(track.id) && styles.localTrackRowSelected,
              )}
            >
              <span {...stylex.props(styles.selectionCell)}>
                {isBatchSelecting && (
                  <input
                    aria-label={`选择 ${fileName}`}
                    checked={selectedTrackIDs.has(track.id)}
                    type="checkbox"
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => onToggleSelection(track.id)}
                  />
                )}
              </span>
              <span {...stylex.props(styles.numberCell)}>{index + 1}</span>
              <span {...stylex.props(styles.fileNameCell)}>
                <button
                  aria-label={`播放 ${track.title}`}
                  title={`播放 ${track.title}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void playTrack();
                  }}
                  {...stylex.props(styles.trackPlayButton)}
                >
                  {isCurrentTrack ? (
                    <Icon name="musicalNotes" size={16} />
                  ) : (
                    <Icon name="play" size={16} />
                  )}
                </button>
                <span title={fileName} {...stylex.props(styles.cellText)}>
                  {fileName}
                </span>
              </span>
              <span
                title={track.artists.join(', ')}
                {...stylex.props(styles.cellText)}
              >
                {track.artists.join(', ') || '未知艺术家'}
              </span>
              <span title={track.album} {...stylex.props(styles.cellText)}>
                {track.album || '未知专辑'}
              </span>
              <span {...stylex.props(styles.durationCell)}>
                {Math.floor(track.duration / 60)
                  .toString()
                  .padStart(2, '0')}
                :
                {Math.floor(track.duration % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
              <span>
                <span {...stylex.props(styles.qualityBadge)}>{format}</span>
              </span>
              <span {...stylex.props(styles.fileSizeCell)}>
                暂无本地文件信息
              </span>
              <span {...stylex.props(styles.playbackStatusCell)}>
                {isCurrentTrack ? '当前曲目' : '未播放'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LocalTrackGridItem(props: {
  track: Track;
  tracks: Track[];
  selected: boolean;
  isBatchSelecting: boolean;
  onToggleSelection: (trackID: string) => void;
}) {
  const { track, tracks, selected, isBatchSelecting, onToggleSelection } =
    props;
  const playingTrackID = usePlayingTrackID();
  const isPlaying = track.id === playingTrackID;

  return (
    <article
      data-local-track-id={track.id}
      data-is-playing={isPlaying || undefined}
      {...stylex.props(styles.trackCard, selected && styles.trackCardSelected)}
    >
      <button
        aria-label={`播放 ${track.title}`}
        title={`播放 ${track.title}`}
        type="button"
        onClick={() => void player.start(tracks, track.id, QUEUE_ORIGIN)}
        {...stylex.props(styles.coverButton)}
      >
        <Cover track={track} iconSize={28} />
        <span
          aria-hidden="true"
          {...stylex.props(
            styles.coverOverlay,
            isPlaying && styles.coverOverlayPlaying,
          )}
        >
          <Icon name={isPlaying ? 'musicalNotes' : 'play'} size={20} />
        </span>
      </button>
      <div {...stylex.props(styles.trackCardCopy)}>
        <strong title={track.title} {...stylex.props(styles.trackCardTitle)}>
          {track.title}
        </strong>
        <span
          title={track.artists.join(', ')}
          {...stylex.props(styles.trackCardMeta)}
        >
          {track.artists.join(', ') || '未知艺术家'}
        </span>
        <span title={track.album} {...stylex.props(styles.trackCardMeta)}>
          {track.album || '未知专辑'}
        </span>
      </div>
      <div {...stylex.props(styles.trackCardFooter)}>
        <span {...stylex.props(styles.qualityBadge)}>
          {getTrackFormat(track)}
        </span>
        <span {...stylex.props(styles.trackCardFileSize)}>
          暂无本地文件信息
        </span>
        <span
          aria-live="polite"
          {...stylex.props(
            styles.trackCardPlaybackStatus,
            isPlaying && styles.trackCardPlaybackStatusPlaying,
          )}
        >
          {isPlaying ? '当前曲目' : '未播放'}
        </span>
      </div>
      {isBatchSelecting && (
        <label {...stylex.props(styles.selectionControl)}>
          <input
            aria-label={`选择 ${getFileName(track.path)}`}
            checked={selected}
            type="checkbox"
            onChange={() => onToggleSelection(track.id)}
          />
          <span>选择</span>
        </label>
      )}
    </article>
  );
}

const skeletonShimmerAnimation = stylex.keyframes({
  '0%': { backgroundPosition: '120% 0' },
  '100%': { backgroundPosition: '-20% 0' },
});

export function LocalMusicLoadingSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="正在读取本地音乐"
      data-testid="local-music-loading-skeleton"
      role="status"
      {...stylex.props(styles.loadingSkeleton)}
    >
      <div aria-hidden="true" {...stylex.props(styles.skeletonHero)}>
        <span {...stylex.props(styles.skeletonCover)} />
        <div {...stylex.props(styles.skeletonHeroCopy)}>
          <span {...stylex.props(styles.skeletonEyebrow)} />
          <span {...stylex.props(styles.skeletonTitle)} />
          <span {...stylex.props(styles.skeletonMeta)} />
          <span {...stylex.props(styles.skeletonPath)} />
        </div>
        <div {...stylex.props(styles.skeletonActions)}>
          <span {...stylex.props(styles.skeletonAction)} />
          <span {...stylex.props(styles.skeletonAction)} />
        </div>
      </div>

      <div aria-hidden="true" {...stylex.props(styles.skeletonSection)}>
        <div {...stylex.props(styles.skeletonSectionHeader)}>
          <span {...stylex.props(styles.skeletonSectionTitle)} />
          <span {...stylex.props(styles.skeletonToolbar)} />
        </div>
        <div {...stylex.props(styles.skeletonList)}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              data-testid="local-music-loading-row"
              {...stylex.props(styles.skeletonRow)}
            >
              <span {...stylex.props(styles.skeletonIndex)} />
              <span {...stylex.props(styles.skeletonFileName)} />
              <span {...stylex.props(styles.skeletonArtist)} />
              <span {...stylex.props(styles.skeletonAlbum)} />
              <span {...stylex.props(styles.skeletonDuration)} />
              <span {...stylex.props(styles.skeletonBadge)} />
            </div>
          ))}
        </div>
      </div>

      <p {...stylex.props(styles.skeletonMessage)}>正在读取本地音乐...</p>
    </section>
  );
}

function ViewLocalMusic() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { getMainContentElement } = useAppShell();
  const invalidate = useInvalidate();
  const config = useSuspenseQuery(configQuery).data;
  const { data: tracks, isError, isLoading } = useQuery(allTracksQuery);
  const isRefreshing = useLibraryStore((state) => state.refreshing);
  const allTracks = tracks ?? EMPTY_TRACKS;
  const [viewMode, setViewMode] = useState<LocalMusicView>(() =>
    window.localStorage.getItem(LOCAL_MUSIC_VIEW_KEY) === 'grid'
      ? 'grid'
      : 'list',
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(() =>
    window.localStorage.getItem(LOCAL_MUSIC_FOLDER_KEY),
  );
  const [localSearch, setLocalSearch] = useState('');
  const [selectedTrackIDs, setSelectedTrackIDs] = useState<Set<string>>(
    new Set(),
  );
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isBatchSelecting, setIsBatchSelecting] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [folderHistory, setFolderHistory] = useState(readFolderHistory);
  const [sortKey, setSortKey] = useState<LocalSortKey>('filename');
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('ascending');
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const hasStoredFolderHistory = useRef(
    window.localStorage.getItem(LOCAL_MUSIC_FOLDER_HISTORY_KEY) !== null,
  );
  const playingTrackID = usePlayingTrackID();

  const libraryFolders = config.library_folders;
  const currentFolder =
    selectedFolder != null && libraryFolders.includes(selectedFolder)
      ? selectedFolder
      : (folderHistory.find((folder) => libraryFolders.includes(folder)) ??
        libraryFolders[0] ??
        null);
  const folderTracks = useMemo(() => {
    if (currentFolder === null) return EMPTY_TRACKS;
    return allTracks.filter((track) =>
      belongsToFolder(track.path, currentFolder),
    );
  }, [allTracks, currentFolder]);
  const globallyFilteredTracks = useFilteredTracks(
    folderTracks,
    config.library_sort_by,
    config.library_sort_order,
  );
  const visibleTracks = useMemo(() => {
    const query = localSearch.trim().toLocaleLowerCase();
    if (query === '') return globallyFilteredTracks;

    return globallyFilteredTracks.filter((track) =>
      [track.title, track.artists.join(', '), track.album, track.path].some(
        (value) => value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [globallyFilteredTracks, localSearch]);
  const selectedVisibleTracks = useMemo(
    () => visibleTracks.filter((track) => selectedTrackIDs.has(track.id)),
    [selectedTrackIDs, visibleTracks],
  );
  const sortedVisibleTracks = useMemo(() => {
    const collator = new Intl.Collator('zh-CN', {
      numeric: true,
      sensitivity: 'base',
    });
    const sortedTracks = [...visibleTracks].sort((first, second) => {
      const firstValue =
        sortKey === 'filename'
          ? getFileName(first.path)
          : sortKey === 'artist'
            ? first.artists.join(', ')
            : sortKey === 'album'
              ? first.album
              : sortKey === 'duration'
                ? first.duration
                : getTrackFormat(first);
      const secondValue =
        sortKey === 'filename'
          ? getFileName(second.path)
          : sortKey === 'artist'
            ? second.artists.join(', ')
            : sortKey === 'album'
              ? second.album
              : sortKey === 'duration'
                ? second.duration
                : getTrackFormat(second);
      const result =
        typeof firstValue === 'number' && typeof secondValue === 'number'
          ? firstValue - secondValue
          : collator.compare(String(firstValue), String(secondValue));

      return sortDirection === 'ascending' ? result : -result;
    });

    return sortedTracks;
  }, [sortDirection, sortKey, visibleTracks]);
  const formatSummary = useMemo(() => {
    const formats = Array.from(
      new Set(folderTracks.map((track) => getTrackFormat(track))),
    );

    return formats.length === 0 ? '格式将在扫描后显示' : formats.join('、');
  }, [folderTracks]);
  const playingTrackIsVisible =
    playingTrackID != null &&
    visibleTracks.some((track) => track.id === playingTrackID);
  const actionsDisabled =
    isLoading || isRefreshing || isAddingFolder || isChangingFolder;
  const allVisibleSelected =
    visibleTracks.length > 0 &&
    visibleTracks.every((track) => selectedTrackIDs.has(track.id));

  const addToFolderHistory = useCallback((folder: string) => {
    setFolderHistory((history) =>
      [folder, ...history.filter((item) => item !== folder)].slice(
        0,
        MAX_FOLDER_HISTORY,
      ),
    );
  }, []);

  useEffect(() => {
    if (currentFolder === null) {
      window.localStorage.removeItem(LOCAL_MUSIC_FOLDER_KEY);
      return;
    }

    window.localStorage.setItem(LOCAL_MUSIC_FOLDER_KEY, currentFolder);
  }, [currentFolder]);

  useEffect(() => {
    if (hasStoredFolderHistory.current) return;

    hasStoredFolderHistory.current = true;
    setFolderHistory(libraryFolders.slice(0, MAX_FOLDER_HISTORY));
  }, [libraryFolders]);

  useEffect(() => {
    window.localStorage.setItem(
      LOCAL_MUSIC_FOLDER_HISTORY_KEY,
      JSON.stringify(folderHistory),
    );
  }, [folderHistory]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!folderMenuRef.current?.contains(target)) setIsFolderMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsFolderMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, []);

  const setLocalViewMode = useCallback((nextViewMode: LocalMusicView) => {
    setViewMode(nextViewMode);
    setIsBatchSelecting(false);
    setSelectedTrackIDs(new Set());
    window.localStorage.setItem(LOCAL_MUSIC_VIEW_KEY, nextViewMode);
  }, []);

  const addMusicFolder = useCallback(async () => {
    setIsAddingFolder(true);
    try {
      const path = await open({ directory: true, multiple: false });
      if (path === null || Array.isArray(path)) return;

      await LibraryAPI.addLibraryFolders([path]);
      await LibraryAPI.scan();
      setSelectedFolder(path);
      addToFolderHistory(path);
      await invalidate();
    } finally {
      setIsAddingFolder(false);
    }
  }, [addToFolderHistory, invalidate]);

  const refreshLibrary = useCallback(async () => {
    if (libraryFolders.length === 0) return;
    await LibraryAPI.scan();
    await invalidate();
  }, [invalidate, libraryFolders.length]);

  const appendSelectedToQueue = useCallback(() => {
    if (selectedVisibleTracks.length === 0) return;
    player.addToQueue(selectedVisibleTracks);
    toastManager.add({
      title: `已将 ${selectedVisibleTracks.length} 首本地歌曲加入播放队列`,
      type: 'success',
    });
    setIsBatchSelecting(false);
    setSelectedTrackIDs(new Set());
  }, [selectedVisibleTracks]);

  const toggleGridSelection = useCallback((trackID: string) => {
    setSelectedTrackIDs((current) => {
      const next = new Set(current);
      if (next.has(trackID)) next.delete(trackID);
      else next.add(trackID);
      return next;
    });
  }, []);

  const toggleLocalSort = useCallback(
    (nextSortKey: LocalSortKey) => {
      if (sortKey === nextSortKey) {
        setSortDirection((currentDirection) =>
          currentDirection === 'ascending' ? 'descending' : 'ascending',
        );
        return;
      }

      setSortKey(nextSortKey);
      setSortDirection('ascending');
    },
    [sortKey],
  );

  const exitBatchSelection = useCallback(() => {
    setIsBatchSelecting(false);
    setSelectedTrackIDs(new Set());
  }, []);

  const toggleSelectAllVisibleTracks = useCallback(() => {
    setSelectedTrackIDs((selectedTracks) => {
      if (
        visibleTracks.length > 0 &&
        visibleTracks.every((track) => selectedTracks.has(track.id))
      ) {
        return new Set();
      }

      return new Set(visibleTracks.map((track) => track.id));
    });
  }, [visibleTracks]);

  const switchFolder = useCallback(
    async (folder: string) => {
      setIsChangingFolder(true);
      setIsFolderMenuOpen(false);
      setSelectedTrackIDs(new Set());
      setSelectedFolder(folder);
      addToFolderHistory(folder);

      try {
        await LibraryAPI.scan();
        await invalidate();
      } finally {
        setIsChangingFolder(false);
      }
    },
    [addToFolderHistory, invalidate],
  );

  const removeFolderFromHistory = useCallback(
    (folder: string) => {
      const nextHistory = folderHistory.filter((item) => item !== folder);
      setFolderHistory(nextHistory);
      setSelectedTrackIDs(new Set());

      if (folder === currentFolder && nextHistory[0] !== undefined) {
        setSelectedFolder(nextHistory[0]);
      }
    },
    [currentFolder, folderHistory],
  );

  useEffect(() => {
    const mainContent = getMainContentElement();
    if (mainContent === null) return;

    const updateHeaderState = () => {
      const heroHeight = heroRef.current?.offsetHeight ?? 0;
      setIsHeaderCollapsed(
        mainContent.scrollTop > Math.max(88, heroHeight / 2),
      );
    };

    updateHeaderState();
    mainContent.addEventListener('scroll', updateHeaderState, {
      passive: true,
    });
    return () => mainContent.removeEventListener('scroll', updateHeaderState);
  }, [getMainContentElement]);

  const scrollToPlayingTrack = useCallback(() => {
    if (playingTrackID === null) return;

    if (viewMode === 'list') {
      void navigate({
        to: '.',
        search: { jump_to_playing_track: true },
      });
      return;
    }

    document
      .querySelector<HTMLElement>(`[data-local-track-id="${playingTrackID}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [navigate, playingTrackID, viewMode]);

  return (
    <View xstyle={styles.view}>
      <main
        data-reference-layout="moekoe-local-music"
        {...stylex.props(styles.page)}
      >
        {isLoading ? (
          <LocalMusicLoadingSkeleton />
        ) : (
          <>
            <section
              ref={heroRef}
              aria-labelledby="local-music-title"
              data-collapsed={isHeaderCollapsed || undefined}
              data-testid="local-music-sticky-header"
              {...stylex.props(
                styles.hero,
                isHeaderCollapsed && styles.heroCollapsed,
              )}
            >
              {!isHeaderCollapsed && (
                <span aria-hidden="true" {...stylex.props(styles.heroArt)}>
                  <HardDrive size={42} strokeWidth={1.75} />
                </span>
              )}
              <div {...stylex.props(styles.heroCopy)}>
                {!isHeaderCollapsed && (
                  <p {...stylex.props(styles.eyebrow)}>本地资料库</p>
                )}
                <h1 id="local-music-title" {...stylex.props(styles.heroTitle)}>
                  本地音乐
                </h1>
                {!isHeaderCollapsed && (
                  <>
                    <p {...stylex.props(styles.heroMeta)}>
                      本地歌曲数：{folderTracks.length}
                    </p>
                    {currentFolder !== null ? (
                      <p
                        title={currentFolder}
                        {...stylex.props(styles.folderPath)}
                      >
                        <HardDrive
                          aria-hidden="true"
                          size={15}
                          strokeWidth={1.9}
                        />
                        <span>{currentFolder}</span>
                      </p>
                    ) : (
                      <p {...stylex.props(styles.description)}>
                        选择并授权一个本地音乐文件夹后，这里会显示扫描到的真实曲目。
                      </p>
                    )}
                    <p {...stylex.props(styles.description)}>
                      已扫描格式：{formatSummary}
                    </p>
                  </>
                )}
              </div>
              <div
                aria-label="本地音乐操作"
                {...stylex.props(styles.heroActions)}
              >
                {sortedVisibleTracks.length > 0 && (
                  <button
                    aria-label="播放当前文件夹的全部歌曲"
                    disabled={actionsDisabled}
                    title="播放全部"
                    type="button"
                    onClick={() => {
                      const firstTrack = visibleTracks[0];
                      if (firstTrack === undefined) return;
                      void player.start(
                        visibleTracks,
                        firstTrack.id,
                        QUEUE_ORIGIN,
                      );
                    }}
                    {...stylex.props(styles.primaryAction)}
                  >
                    <Icon name="play" size={16} />
                    <span>播放全部</span>
                  </button>
                )}
                {!isHeaderCollapsed && (
                  <>
                    <button
                      aria-label="选择音乐文件夹"
                      disabled={actionsDisabled}
                      title="选择音乐文件夹"
                      type="button"
                      onClick={() => void addMusicFolder()}
                      {...stylex.props(styles.secondaryAction)}
                    >
                      <FolderPlus
                        aria-hidden="true"
                        size={16}
                        strokeWidth={2}
                      />
                      <span>
                        {currentFolder === null
                          ? '选择音乐文件夹'
                          : '重新选择文件夹'}
                      </span>
                    </button>
                    {folderHistory.length > 0 && (
                      <div
                        ref={folderMenuRef}
                        {...stylex.props(styles.menuContainer)}
                      >
                        <button
                          aria-controls="local-music-folders"
                          aria-expanded={isFolderMenuOpen}
                          aria-label="快速切换音乐文件夹"
                          disabled={actionsDisabled}
                          title="最近文件夹"
                          type="button"
                          onClick={() =>
                            setIsFolderMenuOpen((openMenu) => !openMenu)
                          }
                          {...stylex.props(styles.secondaryAction)}
                        >
                          <HardDrive
                            aria-hidden="true"
                            size={16}
                            strokeWidth={2}
                          />
                          <span>最近文件夹</span>
                          <Icon name="chevronDown" size={12} />
                        </button>
                        {isFolderMenuOpen && (
                          <div
                            id="local-music-folders"
                            role="menu"
                            {...stylex.props(styles.popoverMenu)}
                          >
                            {folderHistory.map((folder) => (
                              <div
                                key={folder}
                                role="none"
                                {...stylex.props(styles.historyItem)}
                              >
                                <button
                                  aria-current={
                                    folder === currentFolder
                                      ? 'true'
                                      : undefined
                                  }
                                  role="menuitem"
                                  title={folder}
                                  type="button"
                                  onClick={() => void switchFolder(folder)}
                                  {...stylex.props(
                                    styles.menuItem,
                                    styles.historySelectButton,
                                    folder === currentFolder &&
                                      styles.menuItemCurrent,
                                  )}
                                >
                                  <HardDrive
                                    aria-hidden="true"
                                    size={15}
                                    strokeWidth={1.9}
                                  />
                                  <span>{getFolderName(folder)}</span>
                                </button>
                                <button
                                  aria-label={`从最近文件夹中移除 ${getFolderName(folder)}`}
                                  title="移除历史记录"
                                  type="button"
                                  onClick={() =>
                                    removeFolderFromHistory(folder)
                                  }
                                  {...stylex.props(styles.historyRemoveButton)}
                                >
                                  <Trash2
                                    aria-hidden="true"
                                    size={15}
                                    strokeWidth={2}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      aria-label="扫描已添加的音乐文件夹"
                      disabled={actionsDisabled || libraryFolders.length === 0}
                      title="刷新"
                      type="button"
                      onClick={() => void refreshLibrary()}
                      {...stylex.props(styles.secondaryAction)}
                    >
                      <Icon name="refresh" size={16} />
                      <span>{isRefreshing ? '正在扫描' : '刷新'}</span>
                    </button>
                  </>
                )}
              </div>
            </section>

            <section
              aria-labelledby="local-track-list-title"
              {...stylex.props(styles.trackSection)}
            >
              <div {...stylex.props(styles.sectionHeader)}>
                <div {...stylex.props(styles.sectionCopy)}>
                  <h2
                    id="local-track-list-title"
                    {...stylex.props(styles.sectionTitle)}
                  >
                    本地歌曲
                  </h2>
                  <span {...stylex.props(styles.trackCount)}>
                    ( {visibleTracks.length} )
                  </span>
                </div>
                <div
                  aria-label="本地歌曲工具栏"
                  {...stylex.props(styles.toolbar)}
                >
                  {!isBatchSelecting ? (
                    <button
                      aria-label="进入批量选择"
                      title="批量选择"
                      type="button"
                      onClick={() => setIsBatchSelecting(true)}
                      {...stylex.props(styles.toolButton)}
                    >
                      <ListPlus aria-hidden="true" size={16} strokeWidth={2} />
                      <span>批量选择</span>
                    </button>
                  ) : (
                    <>
                      <button
                        aria-label={
                          selectedVisibleTracks.length ===
                            visibleTracks.length && visibleTracks.length > 0
                            ? '取消全选'
                            : '全选当前列表'
                        }
                        title={
                          selectedVisibleTracks.length ===
                            visibleTracks.length && visibleTracks.length > 0
                            ? '取消全选'
                            : '全选'
                        }
                        type="button"
                        onClick={toggleSelectAllVisibleTracks}
                        {...stylex.props(styles.toolButton)}
                      >
                        <ListChecks
                          aria-hidden="true"
                          size={16}
                          strokeWidth={2}
                        />
                        <span>
                          {selectedVisibleTracks.length ===
                            visibleTracks.length && visibleTracks.length > 0
                            ? '取消全选'
                            : '全选'}
                        </span>
                      </button>
                      <span
                        aria-live="polite"
                        {...stylex.props(styles.selectionSummary)}
                      >
                        已选择 {selectedVisibleTracks.length} 首
                      </span>
                      <button
                        aria-label="将所选歌曲加入播放队列"
                        disabled={selectedVisibleTracks.length === 0}
                        title="加入播放队列"
                        type="button"
                        onClick={appendSelectedToQueue}
                        {...stylex.props(
                          styles.toolButton,
                          styles.toolButtonActive,
                        )}
                      >
                        <ListPlus
                          aria-hidden="true"
                          size={16}
                          strokeWidth={2}
                        />
                        <span>加入队列</span>
                      </button>
                      <button
                        aria-label="退出批量选择"
                        title="退出批量选择"
                        type="button"
                        onClick={exitBatchSelection}
                        {...stylex.props(styles.toolButton)}
                      >
                        <Icon name="close" size={16} />
                        <span>退出选择</span>
                      </button>
                    </>
                  )}
                  <button
                    aria-label={
                      viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'
                    }
                    aria-pressed={viewMode === 'grid'}
                    title={
                      viewMode === 'list' ? '切换到网格视图' : '切换到列表视图'
                    }
                    type="button"
                    onClick={() =>
                      setLocalViewMode(viewMode === 'list' ? 'grid' : 'list')
                    }
                    {...stylex.props(styles.iconButton)}
                  >
                    {viewMode === 'list' ? (
                      <LayoutGrid
                        aria-hidden="true"
                        size={17}
                        strokeWidth={2}
                      />
                    ) : (
                      <ListChecks
                        aria-hidden="true"
                        size={17}
                        strokeWidth={2}
                      />
                    )}
                  </button>
                  <button
                    aria-label="定位当前播放歌曲"
                    disabled={!playingTrackIsVisible}
                    title="定位当前播放歌曲"
                    type="button"
                    onClick={scrollToPlayingTrack}
                    {...stylex.props(styles.iconButton)}
                  >
                    <LocateFixed aria-hidden="true" size={17} strokeWidth={2} />
                  </button>
                  <label {...stylex.props(styles.searchField)}>
                    <Icon name="search" size={16} />
                    <input
                      aria-label="搜索本地歌曲"
                      placeholder="搜索歌曲"
                      value={localSearch}
                      onChange={(event) => setLocalSearch(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              {!isLoading && isError && (
                <div
                  role="alert"
                  {...stylex.props(styles.statePanel, styles.errorPanel)}
                >
                  <Icon name="close" size={24} />
                  <p>无法读取本地音乐库，请检查文件夹权限后重试。</p>
                  <button
                    type="button"
                    onClick={() => void refreshLibrary()}
                    {...stylex.props(styles.secondaryAction)}
                  >
                    <Icon name="refresh" size={16} />
                    <span>重试扫描</span>
                  </button>
                </div>
              )}
              {!isLoading && !isError && currentFolder === null && (
                <div
                  data-testid="local-music-welcome"
                  {...stylex.props(styles.statePanel)}
                >
                  <HardDrive aria-hidden="true" size={34} strokeWidth={1.6} />
                  <h3>欢迎使用本地音乐</h3>
                  <p>请选择并授权一个音乐文件夹。</p>
                  <button
                    type="button"
                    onClick={() => void addMusicFolder()}
                    {...stylex.props(styles.primaryAction)}
                  >
                    <FolderPlus aria-hidden="true" size={16} strokeWidth={2} />
                    <span>选择音乐文件夹</span>
                  </button>
                </div>
              )}
              {!isLoading &&
                !isError &&
                currentFolder !== null &&
                visibleTracks.length === 0 && (
                  <div
                    data-testid="local-music-empty"
                    {...stylex.props(styles.statePanel)}
                  >
                    <Icon name="musicalNotes" size={28} />
                    <h3>
                      {localSearch === ''
                        ? '该文件夹中没有本地歌曲'
                        : '没有匹配的本地歌曲'}
                    </h3>
                    <p>
                      {localSearch === ''
                        ? '扫描已添加的文件夹后，可播放的本地曲目会显示在这里。'
                        : '请修改搜索关键词，或清空搜索后查看该文件夹的全部曲目。'}
                    </p>
                  </div>
                )}
              {!isLoading &&
                !isError &&
                sortedVisibleTracks.length > 0 &&
                viewMode === 'list' && (
                  <div {...stylex.props(styles.listSurface)}>
                    <LocalMusicTrackList
                      tracks={sortedVisibleTracks}
                      playbackTracks={visibleTracks}
                      sortKey={sortKey}
                      sortDirection={sortDirection}
                      selectedTrackIDs={selectedTrackIDs}
                      isBatchSelecting={isBatchSelecting}
                      allVisibleSelected={allVisibleSelected}
                      onSort={toggleLocalSort}
                      onToggleSelection={toggleGridSelection}
                      onToggleSelectAll={toggleSelectAllVisibleTracks}
                    />
                  </div>
                )}
              {!isLoading &&
                !isError &&
                sortedVisibleTracks.length > 0 &&
                viewMode === 'grid' && (
                  <div
                    aria-label="本地歌曲网格"
                    role="grid"
                    {...stylex.props(styles.trackGrid)}
                  >
                    {sortedVisibleTracks.map((track) => (
                      <LocalTrackGridItem
                        key={track.id}
                        track={track}
                        tracks={visibleTracks}
                        selected={selectedTrackIDs.has(track.id)}
                        isBatchSelecting={isBatchSelecting}
                        onToggleSelection={toggleGridSelection}
                      />
                    ))}
                  </div>
                )}
            </section>
          </>
        )}
        <BackToTop />
      </main>
    </View>
  );
}

const skeletonBlockStyles = {
  display: 'block',
  backgroundImage:
    'linear-gradient(100deg, var(--surface-hover) 8%, var(--surface-selected) 18%, var(--surface-hover) 33%)',
  backgroundSize: '800px 104px',
  borderRadius: '6px',
  animationName: {
    default: skeletonShimmerAnimation,
    '@media (prefers-reduced-motion: reduce)': 'none',
  },
  animationDuration: '1.5s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'linear',
} as const;

const styles = stylex.create({
  view: {
    padding: 0,
  },
  page: {
    width: 'min(1280px, 100%)',
    marginInline: 'auto',
    padding: {
      default: '24px',
      '@media (max-width: 1024px)': '20px',
      '@media (max-width: 700px)': '16px 14px',
    },
    display: 'flex',
    flexDirection: 'column',
    rowGap: '28px',
  },
  hero: {
    minWidth: 0,
    position: 'sticky',
    top: '8px',
    zIndex: 10,
    display: 'grid',
    gridTemplateColumns: {
      default: '112px minmax(0, 1fr) auto',
      '@media (max-width: 1024px)': '88px minmax(0, 1fr)',
      '@media (max-width: 700px)': '1fr',
    },
    alignItems: 'center',
    rowGap: '20px',
    columnGap: '20px',
    padding: {
      default: '24px',
      '@media (max-width: 700px)': '18px',
    },
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    boxShadow: '0 9px 24px rgba(38, 28, 54, 0.08)',
    transition: {
      default:
        'grid-template-columns 160ms ease-out, padding 160ms ease-out, box-shadow 160ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  heroCollapsed: {
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    rowGap: 0,
    columnGap: '12px',
    paddingBlock: '10px',
    paddingInline: '14px',
    boxShadow: '0 8px 20px rgba(38, 28, 54, 0.16)',
  },
  heroArt: {
    width: {
      default: '112px',
      '@media (max-width: 1024px)': '88px',
      '@media (max-width: 700px)': '64px',
    },
    height: {
      default: '112px',
      '@media (max-width: 1024px)': '88px',
      '@media (max-width: 700px)': '64px',
    },
    display: 'grid',
    placeItems: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    borderRadius: '8px',
  },
  heroCopy: {
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 700,
  },
  heroTitle: {
    marginTop: '4px',
    marginBottom: 0,
    marginInline: 0,
    color: 'var(--text-primary)',
    fontSize: '30px',
    fontWeight: 750,
    lineHeight: 1.2,
  },
  heroMeta: {
    marginTop: '8px',
    marginBottom: 0,
    marginInline: 0,
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: 650,
    fontVariantNumeric: 'tabular-nums',
  },
  folderPath: {
    minWidth: 0,
    marginTop: '8px',
    marginBottom: 0,
    marginInline: 0,
    display: 'flex',
    alignItems: 'center',
    columnGap: '7px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  description: {
    marginTop: '6px',
    marginBottom: 0,
    marginInline: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  heroActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: {
      default: 'flex-end',
      '@media (max-width: 1024px)': 'flex-start',
    },
    rowGap: '8px',
    columnGap: '8px',
    gridColumn: {
      '@media (max-width: 1024px)': '1 / -1',
    },
  },
  primaryAction: {
    minHeight: '34px',
    paddingInline: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '7px',
    color: 'var(--accent-contrast)',
    backgroundColor: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent)',
    borderRadius: '6px',
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    fontSize: '13px',
    fontWeight: 650,
    filter: {
      ':hover': 'brightness(0.96)',
    },
    opacity: {
      ':disabled': 0.55,
    },
  },
  secondaryAction: {
    minHeight: '34px',
    paddingInline: '11px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '7px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'var(--surface-base)',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    borderRadius: '6px',
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    fontSize: '13px',
    fontWeight: 600,
    opacity: {
      ':disabled': 0.55,
    },
  },
  menuContainer: {
    position: 'relative',
  },
  popoverMenu: {
    minWidth: '208px',
    maxWidth: 'min(320px, calc(100vw - 40px))',
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 20,
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    borderRadius: '6px',
    boxShadow: '0 10px 26px rgba(24, 20, 36, 0.16)',
  },
  menuItem: {
    minWidth: 0,
    minHeight: '34px',
    paddingInline: '8px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
    },
    borderStyle: 'none',
    borderRadius: '5px',
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    fontSize: '13px',
    textAlign: 'left',
    color: {
      default: 'var(--text-primary)',
      ':disabled': 'var(--text-muted)',
    },
  },
  menuItemCurrent: {
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
  },
  historyItem: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'stretch',
    columnGap: '2px',
  },
  historySelectButton: {
    flexGrow: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  historyRemoveButton: {
    width: '34px',
    flexShrink: 0,
    display: 'inline-grid',
    placeItems: 'center',
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--danger-color)',
    },
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  trackSection: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '14px',
  },
  sectionHeader: {
    minWidth: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: '12px',
    columnGap: '12px',
  },
  sectionCopy: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: '8px',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '23px',
    fontWeight: 700,
  },
  trackCount: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontVariantNumeric: 'tabular-nums',
  },
  toolbar: {
    minWidth: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: {
      default: 'flex-end',
      '@media (max-width: 700px)': 'flex-start',
    },
    width: {
      '@media (max-width: 700px)': '100%',
    },
    rowGap: '8px',
    columnGap: '8px',
  },
  toolButton: {
    minHeight: '34px',
    paddingInline: '10px',
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '6px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'var(--surface-base)',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  toolButtonActive: {
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
    borderColor: 'var(--accent)',
  },
  selectionSummary: {
    minHeight: '34px',
    paddingInline: '9px',
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
    borderRadius: '6px',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
  },
  iconButton: {
    width: '34px',
    height: '34px',
    padding: 0,
    display: 'inline-grid',
    placeItems: 'center',
    backgroundColor: {
      default: 'var(--surface-base)',
      ':hover': 'var(--surface-hover)',
    },
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    borderRadius: '6px',
    cursor: {
      default: 'pointer',
      ':disabled': 'not-allowed',
    },
    color: {
      default: 'var(--text-primary)',
      ':disabled': 'var(--text-muted)',
    },
  },
  searchField: {
    minWidth: {
      default: '220px',
      '@media (max-width: 700px)': '100%',
    },
    height: '34px',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    columnGap: '7px',
    paddingInline: '10px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-base)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'var(--border-strong)',
      ':focus-within': 'var(--accent)',
    },
    borderRadius: '17px',
  },
  listSurface: {
    minHeight: '360px',
    height: {
      default: 'min(54dvh, 620px)',
      '@media (max-width: 700px)': 'min(50dvh, 520px)',
    },
    overflowX: 'auto',
    overflowY: 'auto',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
  },
  localTrackTable: {
    minWidth: '1040px',
    minHeight: '100%',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  localTrackHeader: {
    minWidth: '1040px',
    position: 'sticky',
    top: 0,
    zIndex: 2,
    display: 'grid',
    gridTemplateColumns:
      '36px 48px minmax(180px, 2fr) minmax(120px, 1fr) minmax(140px, 1fr) 76px 76px 156px 96px',
    alignItems: 'center',
    minHeight: '40px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-strong)',
    fontSize: '12px',
    fontWeight: 700,
  },
  localTrackRow: {
    minWidth: '1040px',
    display: 'grid',
    gridTemplateColumns:
      '36px 48px minmax(180px, 2fr) minmax(120px, 1fr) minmax(140px, 1fr) 76px 76px 156px 96px',
    alignItems: 'center',
    minHeight: '48px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'var(--surface-raised)',
      ':hover': 'var(--surface-hover)',
    },
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  localTrackRowPlaying: {
    boxShadow: 'inset 3px 0 0 var(--accent)',
  },
  localTrackRowSelected: {
    backgroundColor: 'var(--surface-selected)',
  },
  selectionCell: {
    display: 'grid',
    placeItems: 'center',
  },
  numberCell: {
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
  fileNameCell: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    columnGap: '7px',
  },
  trackPlayButton: {
    width: '28px',
    height: '28px',
    flexShrink: 0,
    display: 'inline-grid',
    placeItems: 'center',
    color: 'var(--accent)',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
  },
  cellText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  durationCell: {
    color: 'var(--text-secondary)',
    fontVariantNumeric: 'tabular-nums',
  },
  qualityBadge: {
    maxWidth: '68px',
    paddingBlock: '2px',
    paddingInline: '5px',
    display: 'inline-block',
    overflow: 'hidden',
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileSizeCell: {
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playbackStatusCell: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  sortButton: {
    width: '100%',
    minHeight: '40px',
    paddingInline: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    columnGap: '3px',
    color: 'inherit',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
  },
  sortButtonActive: {
    color: 'var(--accent)',
  },
  trackGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(5, minmax(0, 1fr))',
      '@media (max-width: 1200px)': 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 900px)': 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 767px)': 'repeat(2, minmax(0, 1fr))',
    },
    gap: {
      default: '14px',
      '@media (max-width: 700px)': '10px',
    },
  },
  trackCard: {
    minWidth: 0,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '8px',
    padding: '8px',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
  },
  trackCardSelected: {
    borderColor: 'var(--accent)',
    backgroundColor: 'var(--surface-selected)',
  },
  coverButton: {
    aspectRatio: '1',
    position: 'relative',
    padding: 0,
    overflow: 'hidden',
    backgroundColor: 'var(--cover-bg)',
    borderStyle: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  coverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    opacity: {
      default: 0,
      ':hover': 1,
    },
    transition: {
      default: 'opacity 160ms ease-out',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  coverOverlayPlaying: {
    opacity: 1,
  },
  trackCardCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '3px',
  },
  trackCardTitle: {
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 650,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCardMeta: {
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCardFooter: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '6px',
    columnGap: '6px',
  },
  trackCardFileSize: {
    minWidth: 0,
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackCardPlaybackStatus: {
    marginInlineStart: 'auto',
    color: 'var(--text-secondary)',
    fontSize: '11px',
  },
  trackCardPlaybackStatusPlaying: {
    color: 'var(--accent)',
    fontWeight: 700,
  },
  selectionControl: {
    minWidth: 0,
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '5px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  statePanel: {
    minHeight: '260px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '10px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-strong)',
    borderRadius: '8px',
  },
  errorPanel: {
    color: 'var(--danger-color)',
  },
  loadingSkeleton: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '20px',
  },
  skeletonHero: {
    display: 'grid',
    gridTemplateColumns: {
      default: '112px minmax(0, 1fr) auto',
      '@media (max-width: 1024px)': '88px minmax(0, 1fr)',
      '@media (max-width: 700px)': '1fr',
    },
    alignItems: 'center',
    rowGap: '20px',
    columnGap: '20px',
    padding: {
      default: '24px',
      '@media (max-width: 700px)': '18px',
    },
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
  },
  skeletonCover: {
    width: {
      default: '112px',
      '@media (max-width: 1024px)': '88px',
      '@media (max-width: 700px)': '64px',
    },
    height: {
      default: '112px',
      '@media (max-width: 1024px)': '88px',
      '@media (max-width: 700px)': '64px',
    },
    ...skeletonBlockStyles,
  },
  skeletonHeroCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    rowGap: '10px',
  },
  skeletonEyebrow: {
    width: '84px',
    height: '14px',
    ...skeletonBlockStyles,
  },
  skeletonTitle: {
    width: 'min(260px, 72%)',
    height: '34px',
    ...skeletonBlockStyles,
  },
  skeletonMeta: {
    width: '148px',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonPath: {
    width: 'min(420px, 100%)',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonActions: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: {
      default: 'flex-end',
      '@media (max-width: 1024px)': 'flex-start',
    },
    rowGap: '8px',
    columnGap: '8px',
    gridColumn: {
      '@media (max-width: 1024px)': '1 / -1',
    },
  },
  skeletonAction: {
    width: '92px',
    height: '34px',
    ...skeletonBlockStyles,
  },
  skeletonSection: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '14px',
  },
  skeletonSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '12px',
  },
  skeletonSectionTitle: {
    width: '112px',
    height: '28px',
    ...skeletonBlockStyles,
  },
  skeletonToolbar: {
    width: {
      default: '244px',
      '@media (max-width: 700px)': '132px',
    },
    height: '34px',
    ...skeletonBlockStyles,
  },
  skeletonList: {
    minHeight: '360px',
    paddingBlock: '8px',
    paddingInline: '16px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  skeletonRow: {
    minHeight: '48px',
    display: 'grid',
    gridTemplateColumns:
      '48px minmax(180px, 2fr) minmax(120px, 1fr) minmax(140px, 1fr) 76px 76px',
    alignItems: 'center',
    columnGap: '16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  skeletonIndex: {
    width: '24px',
    height: '14px',
    ...skeletonBlockStyles,
  },
  skeletonFileName: {
    width: '76%',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonArtist: {
    width: '68%',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonAlbum: {
    width: '72%',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonDuration: {
    width: '52px',
    height: '15px',
    ...skeletonBlockStyles,
  },
  skeletonBadge: {
    width: '48px',
    height: '20px',
    ...skeletonBlockStyles,
  },
  skeletonMessage: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    textAlign: 'center',
  },
});
