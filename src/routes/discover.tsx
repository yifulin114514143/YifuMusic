import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import type React from 'react';

import nangongYuCinema from '../assets/moekoe/nangong-yu-cinema.webp';
import BackToTop from '../components/BackToTop';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import type { Playlist, Track } from '../generated/typings';
import player from '../lib/player';
import { allPlaylistsQuery, allTracksQuery, configQuery } from '../lib/queries';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };
const tabs = ['playlist', 'ranking', 'newAlbum', 'newSong'] as const;

type DiscoverTab = (typeof tabs)[number];
type DiscoverSearch = { view?: DiscoverTab };

const tabLabels: Record<DiscoverTab, string> = {
  playlist: '发现歌单',
  ranking: '音乐榜单',
  newAlbum: '新碟上架',
  newSong: '新歌速递',
};

export const Route = createFileRoute('/discover')({
  component: ViewDiscover,
  validateSearch: (search): DiscoverSearch => {
    const view = tabs.includes(search?.view as DiscoverTab)
      ? (search.view as DiscoverTab)
      : undefined;

    return view === undefined ? {} : { view };
  },
});

function LocalPlaylistTile({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      aria-label={playlist.name}
      to="/playlists/$playlistID"
      params={{ playlistID: playlist.id }}
      draggable={false}
      data-museeks-action
      {...stylex.props(styles.playlistTile)}
    >
      <span aria-hidden="true" {...stylex.props(styles.playlistArt)}>
        <span {...stylex.props(styles.playlistArtInner)}>
          <Icon name="playlist" size={28} />
        </span>
      </span>
      <strong title={playlist.name} {...stylex.props(styles.playlistName)}>
        {playlist.name}
      </strong>
      <span {...stylex.props(styles.playlistMeta)}>
        {playlist.tracks.length} 首本地歌曲
      </span>
    </Link>
  );
}

function LocalTrackTile({ track, tracks }: { track: Track; tracks: Track[] }) {
  return (
    <button
      aria-label={`播放 ${track.title}`}
      type="button"
      onClick={() => void player.start(tracks, track.id, QUEUE_ORIGIN)}
      {...stylex.props(styles.trackTile)}
    >
      <span {...stylex.props(styles.trackCover)}>
        <Cover track={track} iconSize={20} />
      </span>
      <span {...stylex.props(styles.trackInfo)}>
        <strong title={track.title} {...stylex.props(styles.trackTitle)}>
          {track.title}
        </strong>
        <small
          title={track.artists.join(', ')}
          {...stylex.props(styles.trackArtist)}
        >
          {track.artists.join(', ')}
        </small>
      </span>
      <span aria-hidden="true" {...stylex.props(styles.trackPlay)}>
        <Icon name="play" size={16} />
      </span>
    </button>
  );
}

function Unavailable(props: { title: string; message: string }) {
  const unavailableLabel = `${props.title}（服务接入后可用）`;

  return (
    <div role="status" {...stylex.props(styles.unavailable)}>
      <span aria-hidden="true" {...stylex.props(styles.unavailableIcon)}>
        <Icon name="cloud" size={28} />
      </span>
      <strong>{props.title}</strong>
      <p>{props.message}</p>
      <button
        aria-disabled="true"
        aria-label={unavailableLabel}
        disabled
        title={unavailableLabel}
        type="button"
        {...stylex.props(styles.unavailableAction)}
      >
        服务接入后可用
      </button>
    </div>
  );
}

function LocalContentState({
  label,
  state,
}: {
  label: string;
  state: 'loading' | 'error';
}) {
  return (
    <div
      aria-label={`${label}${state === 'loading' ? '加载中' : '加载失败'}`}
      role="status"
      {...stylex.props(
        styles.localState,
        state === 'error' && styles.localStateError,
      )}
    >
      <strong>
        {state === 'loading' ? `${label}加载中` : `${label}暂时无法读取`}
      </strong>
      <p>当前不会以示例内容替代真实本地数据。</p>
    </div>
  );
}

function ViewDiscover() {
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const discoverCharacterVisible =
    useSuspenseQuery(configQuery).data.discover_character_visible;
  const {
    data: tracks = [],
    isError: tracksError,
    isLoading: tracksLoading,
  } = useQuery(allTracksQuery);
  const {
    data: playlists = [],
    isError: playlistsError,
    isLoading: playlistsLoading,
  } = useQuery(allPlaylistsQuery);
  const activeTab = view ?? 'playlist';
  const activeTabIndex = tabs.indexOf(activeTab);
  const selectTab = (nextTab: DiscoverTab, focusIndex?: number) => {
    void navigate({
      search: nextTab === 'playlist' ? {} : { view: nextTab },
      replace: true,
    });

    if (focusIndex !== undefined) {
      window.setTimeout(() => {
        document.getElementById(`discover-tab-${tabs[focusIndex]}`)?.focus();
      }, 0);
    }
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case 'ArrowRight':
        nextIndex = (index + 1) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectTab(nextTab, nextIndex);
  };

  return (
    <>
      <main
        data-reference-layout="moekoe-discover"
        {...stylex.props(styles.page)}
      >
        <header {...stylex.props(styles.header)}>
          <h2 {...stylex.props(styles.pageTitle)}>发现</h2>
          <Link
            to="/settings/library"
            draggable={false}
            {...stylex.props(styles.importLink)}
          >
            导入本地音乐
          </Link>
        </header>

        <div {...stylex.props(styles.switchStage)}>
          {discoverCharacterVisible && (
            <img
              alt=""
              aria-hidden="true"
              data-testid="discover-nangong-yu"
              draggable={false}
              src={nangongYuCinema}
              {...stylex.props(styles.floatingNangongYu)}
            />
          )}
          <div
            aria-label="发现分类"
            aria-orientation="horizontal"
            data-reference-layout="moekoe-discover-switch"
            role="tablist"
            {...stylex.props(styles.tabList)}
          >
            <span
              aria-hidden="true"
              data-testid="discover-tab-indicator"
              style={{ transform: `translateX(${activeTabIndex * 100}%)` }}
              {...stylex.props(styles.tabIndicator)}
            />
            {tabs.map((tab, index) => (
              <button
                key={tab}
                aria-controls={`discover-panel-${tab}`}
                aria-selected={activeTab === tab}
                id={`discover-tab-${tab}`}
                role="tab"
                tabIndex={activeTab === tab ? 0 : -1}
                title={tabLabels[tab]}
                type="button"
                onClick={() => selectTab(tab, index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                {...stylex.props(
                  styles.tab,
                  activeTab === tab && styles.tabActive,
                )}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </div>
        </div>

        <section
          aria-label={tabLabels[activeTab]}
          aria-labelledby={`discover-tab-${activeTab}`}
          id={`discover-panel-${activeTab}`}
          role="tabpanel"
        >
          {activeTab === 'playlist' && (
            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.sectionHeading)}>
                <div>
                  <h2 {...stylex.props(styles.sectionTitle)}>本地歌单</h2>
                </div>
                <Link
                  to="/playlists"
                  draggable={false}
                  {...stylex.props(styles.more)}
                >
                  管理歌单
                </Link>
              </div>
              {playlistsLoading ? (
                <LocalContentState label="本地歌单" state="loading" />
              ) : playlistsError ? (
                <LocalContentState label="本地歌单" state="error" />
              ) : playlists.length > 0 ? (
                <div {...stylex.props(styles.playlistGrid)}>
                  {playlists.map((playlist) => (
                    <LocalPlaylistTile key={playlist.id} playlist={playlist} />
                  ))}
                </div>
              ) : (
                <Unavailable
                  title="暂无本地歌单"
                  message="创建歌单或导入包含 .m3u 文件的本地音乐目录后，这里会显示真实内容。"
                />
              )}
              <div {...stylex.props(styles.serviceSection)}>
                <h3 {...stylex.props(styles.serviceTitle)}>推荐歌单</h3>
                <Unavailable
                  title="远程推荐歌单"
                  message="远程歌单需要经服务契约验证并接入；当前不会显示虚构歌单。"
                />
              </div>
            </div>
          )}

          {activeTab === 'newSong' && (
            <div {...stylex.props(styles.section)}>
              <div {...stylex.props(styles.sectionHeading)}>
                <div>
                  <h2 {...stylex.props(styles.sectionTitle)}>本地歌曲</h2>
                </div>
                <Link
                  to="/library"
                  draggable={false}
                  {...stylex.props(styles.more)}
                >
                  打开音乐库
                </Link>
              </div>
              {tracksLoading ? (
                <LocalContentState label="本地歌曲" state="loading" />
              ) : tracksError ? (
                <LocalContentState label="本地歌曲" state="error" />
              ) : tracks.length > 0 ? (
                <div
                  data-testid="discover-track-grid"
                  {...stylex.props(styles.trackGrid)}
                >
                  {tracks.slice(0, 20).map((track) => (
                    <LocalTrackTile
                      key={track.id}
                      track={track}
                      tracks={tracks}
                    />
                  ))}
                </div>
              ) : (
                <Unavailable
                  title="音乐库为空"
                  message="导入本地曲目后可在这里浏览和播放。"
                />
              )}
              <div {...stylex.props(styles.serviceSection)}>
                <h3 {...stylex.props(styles.serviceTitle)}>在线新歌</h3>
                <Unavailable
                  title="在线新歌速递"
                  message="在线新歌需要经服务契约验证并接入；当前不会显示虚构歌曲。"
                />
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <Unavailable
              title="服务接入后可用"
              message="在线音乐榜单需要经服务契约验证并接入；当前不会显示虚构榜单。"
            />
          )}

          {activeTab === 'newAlbum' && (
            <Unavailable
              title="服务接入后可用"
              message="在线新碟内容需要经服务契约验证并接入；当前不会显示虚构专辑。"
            />
          )}
        </section>
      </main>
      <BackToTop />
    </>
  );
}

const styles = stylex.create({
  page: {
    width: 'min(1400px, 100%)',
    marginInline: 'auto',
    position: 'relative',
    padding: {
      default: '20px',
      '@media (max-width: 899px)': '20px',
      '@media (max-width: 599px)': '20px 14px',
    },
  },
  header: {
    minWidth: 0,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '20px',
    rowGap: '14px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '30px',
    fontWeight: 800,
  },
  importLink: {
    flexShrink: 0,
    paddingBlock: '9px',
    paddingInline: '14px',
    color: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '7px',
    backgroundColor: 'var(--accent-subtle)',
    fontSize: '13px',
    fontWeight: 700,
    textDecorationLine: 'none',
  },
  switchStage: {
    minWidth: 0,
    position: 'relative',
    paddingTop: '40px',
    marginBottom: '22px',
  },
  floatingNangongYu: {
    width: 'clamp(112px, 20vw, 180px)',
    height: 'auto',
    position: 'absolute',
    zIndex: 0,
    top: '40px',
    left: '50%',
    pointerEvents: 'none',
    userSelect: 'none',
    transform: 'translate(-50%, -89%)',
    display: {
      default: 'block',
      '@media (max-width: 767px)': 'none',
    },
  },
  tabList: {
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    padding: {
      default: '5px',
      '@media (max-width: 767px)': '4px',
    },
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-sunken)',
  },
  tabIndicator: {
    width: {
      default: 'calc((100% - 10px) / 4)',
      '@media (max-width: 767px)': 'calc((100% - 8px) / 4)',
    },
    position: 'absolute',
    zIndex: 0,
    top: {
      default: '5px',
      '@media (max-width: 767px)': '4px',
    },
    bottom: {
      default: '5px',
      '@media (max-width: 767px)': '4px',
    },
    left: {
      default: '5px',
      '@media (max-width: 767px)': '4px',
    },
    borderRadius: '6px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: '0 4px 12px rgba(31, 41, 55, 0.1)',
    transition: {
      default: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  tab: {
    minWidth: 0,
    minHeight: {
      default: '40px',
      '@media (max-width: 767px)': '36px',
    },
    position: 'relative',
    zIndex: 1,
    paddingBlock: 0,
    paddingInline: '6px',
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    borderWidth: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: {
      default: '14px',
      '@media (max-width: 767px)': '12px',
    },
    fontWeight: 650,
    lineHeight: 1.2,
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tabActive: {
    color: 'var(--accent)',
    fontWeight: 800,
    textDecorationLine: 'underline',
  },
  section: {
    minWidth: 0,
  },
  sectionHeading: {
    marginBottom: '21px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '20px',
    rowGap: '12px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '27px',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  more: {
    flexShrink: 0,
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 750,
    textDecorationLine: 'none',
  },
  playlistGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(auto-fill, minmax(180px, 1fr))',
      '@media (max-width: 599px)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: '22px',
    columnGap: '20px',
  },
  playlistTile: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--text-primary)',
    textDecorationLine: 'none',
    transition: {
      default: 'transform 200ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-4px)',
    },
  },
  playlistArt: {
    aspectRatio: '1',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundImage:
      'linear-gradient(145deg, var(--accent-subtle), var(--surface-raised) 70%)',
    boxShadow: {
      default: '0 10px 20px rgba(28, 55, 88, 0.08)',
      ':hover': '0 17px 31px rgba(28, 55, 88, 0.15)',
    },
  },
  playlistArtInner: {
    width: '70px',
    height: '70px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 10px 22px color-mix(in srgb, var(--accent) 30%, transparent)',
  },
  playlistName: {
    minWidth: 0,
    marginTop: '11px',
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: '15px',
    lineHeight: 1.35,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playlistMeta: {
    marginTop: '4px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  trackGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(5, minmax(0, 1fr))',
      '@media (max-width: 1250px)': 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 1000px)': 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 767px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 449px)': '1fr',
    },
    rowGap: '14px',
    columnGap: '14px',
  },
  trackTile: {
    minWidth: 0,
    position: 'relative',
    paddingTop: '8px',
    paddingRight: '12px',
    paddingBottom: '8px',
    paddingLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    overflow: 'hidden',
    color: 'var(--text-primary)',
    textAlign: 'left',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    boxShadow: {
      default: '0 8px 18px rgba(36, 59, 89, 0.06)',
      ':hover': '0 13px 26px rgba(36, 59, 89, 0.15)',
    },
    cursor: 'pointer',
    transition: {
      default: 'transform 180ms ease, box-shadow 180ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-3px)',
    },
  },
  trackCover: {
    width: '54px',
    height: '54px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-sunken)',
  },
  trackInfo: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    overflow: 'hidden',
  },
  trackTitle: {
    overflow: 'hidden',
    fontSize: '15px',
    lineHeight: 1.35,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackArtist: {
    overflow: 'hidden',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.3,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trackPlay: {
    width: '28px',
    height: '28px',
    position: 'absolute',
    right: '12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    opacity: {
      default: 0,
      ':hover': 1,
    },
    transform: {
      default: 'translateX(8px) scale(0.9)',
      ':hover': 'translateX(0) scale(1)',
    },
    transition: {
      default: 'opacity 180ms ease, transform 180ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
  },
  unavailable: {
    minHeight: '260px',
    padding: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '10px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
  },
  serviceSection: {
    marginTop: '34px',
  },
  serviceTitle: {
    marginTop: 0,
    marginBottom: '16px',
    color: 'var(--text-primary)',
    fontSize: '18px',
    fontWeight: 750,
    lineHeight: 1.3,
  },
  unavailableIcon: {
    width: '52px',
    height: '52px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-subtle)',
  },
  unavailableAction: {
    minHeight: '34px',
    paddingBlock: '7px',
    paddingInline: '10px',
    color: 'var(--text-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '7px',
    backgroundColor: 'var(--surface-sunken)',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    fontSize: '13px',
  },
  localState: {
    minHeight: '260px',
    padding: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '10px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
  },
  localStateError: {
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
  },
});
