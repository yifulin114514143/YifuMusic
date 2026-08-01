import * as stylex from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import type React from 'react';

import BackToTop from '../components/BackToTop';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import type { Playlist, Track } from '../generated/typings';
import player from '../lib/player';
import { allPlaylistsQuery, allTracksQuery } from '../lib/queries';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };

export const Route = createFileRoute('/')({
  component: ViewHome,
});

function startTrack(track: Track, tracks: Track[]) {
  void player.start(tracks, track.id, QUEUE_ORIGIN);
}

function PlaylistTile({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      aria-label={playlist.name}
      to="/playlists/$playlistID"
      params={{ playlistID: playlist.id }}
      draggable={false}
      data-museeks-action
      {...stylex.props(styles.playlistTile)}
    >
      <span aria-hidden="true" {...stylex.props(styles.playlistArtwork)}>
        <span {...stylex.props(styles.playlistDisc)}>
          <Icon name="playlist" size={36} />
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

function LocalTrackCard({ track, tracks }: { track: Track; tracks: Track[] }) {
  return (
    <button
      aria-label={`播放 ${track.title}`}
      type="button"
      onClick={() => startTrack(track, tracks)}
      {...stylex.props(styles.trackCard)}
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

function HomeEmpty(props: {
  icon: 'musicalNotes' | 'playlist';
  children: React.ReactNode;
}) {
  return (
    <div {...stylex.props(styles.emptySection)}>
      <span aria-hidden="true" {...stylex.props(styles.emptyIcon)}>
        <Icon name={props.icon} size={28} />
      </span>
      {props.children}
    </div>
  );
}

function HomeLoading({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label}加载中`}
      data-testid={`home-${label}-loading`}
      role="status"
      {...stylex.props(styles.loadingSection)}
    >
      <span {...stylex.props(styles.loadingLine, styles.loadingLineWide)} />
      <span {...stylex.props(styles.loadingLine)} />
      <span {...stylex.props(styles.loadingLine, styles.loadingLineShort)} />
    </div>
  );
}

function HomeError({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label}加载失败`}
      role="status"
      {...stylex.props(styles.errorSection)}
    >
      <strong>{label}暂时无法读取</strong>
      <p>请稍后重试；当前不会以示例内容替代真实本地数据。</p>
    </div>
  );
}

function UnavailableService({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  const unavailableLabel = `${label}（服务接入后可用）`;

  return (
    <div role="status" {...stylex.props(styles.serviceUnavailable)}>
      <span aria-hidden="true" {...stylex.props(styles.emptyIcon)}>
        <Icon name="cloud" size={28} />
      </span>
      <strong>{label}</strong>
      <p>{message}</p>
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

function RecommendationServiceCard({
  icon,
  title,
  message,
}: {
  icon: 'musicalNotes' | 'compass' | 'playlist';
  title: string;
  message: string;
}) {
  const unavailableLabel = `${title}（服务接入后可用）`;

  return (
    <article {...stylex.props(styles.recommendationCard)}>
      <span aria-hidden="true" {...stylex.props(styles.recommendationIcon)}>
        <Icon name={icon} size={28} />
      </span>
      <div {...stylex.props(styles.recommendationCopy)}>
        <h3 {...stylex.props(styles.recommendationTitle)}>{title}</h3>
        <p {...stylex.props(styles.recommendationMessage)}>{message}</p>
      </div>
      <button
        aria-disabled="true"
        aria-label={unavailableLabel}
        disabled
        title={unavailableLabel}
        type="button"
        {...stylex.props(styles.recommendationAction)}
      >
        服务接入后可用
      </button>
    </article>
  );
}

function ViewHome() {
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
  const visibleTracks = tracks.slice(0, 20);
  const visiblePlaylists = playlists.slice(0, 12);

  return (
    <>
      <main data-reference-layout="moekoe-home" {...stylex.props(styles.page)}>
        <header {...stylex.props(styles.pageHeading)}>
          <h2 {...stylex.props(styles.pageTitle)}>推荐</h2>
        </header>

        <section aria-labelledby="home-top-recommendations">
          <h2
            id="home-top-recommendations"
            {...stylex.props(styles.visuallyHidden)}
          >
            推荐入口
          </h2>
          <div {...stylex.props(styles.recommendations)}>
            <RecommendationServiceCard
              icon="musicalNotes"
              message="私人电台需要经服务契约验证并接入。"
              title="私人电台"
            />
            <RecommendationServiceCard
              icon="compass"
              message="在线榜单需要经服务契约验证并接入。"
              title="音乐榜单"
            />
            <RecommendationServiceCard
              icon="playlist"
              message="远程精选歌单需要经服务契约验证并接入。"
              title="精选歌单"
            />
          </div>
        </section>

        <section aria-labelledby="home-local-recommendations">
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2
                id="home-local-recommendations"
                {...stylex.props(styles.sectionTitle)}
              >
                每日推荐
              </h2>
            </div>
            <div {...stylex.props(styles.sectionActions)}>
              {tracks.length > 0 && !tracksLoading && !tracksError && (
                <button
                  aria-label="将全部本地推荐加入播放队列"
                  data-museeks-action
                  data-testid="home-add-all-to-queue"
                  title="全部加入队列"
                  type="button"
                  onClick={() => player.addToQueue(tracks)}
                  {...stylex.props(styles.queueAction)}
                >
                  <span aria-hidden="true">
                    <Icon name="playlist" size={16} />
                  </span>
                  <span>全部加入队列</span>
                </button>
              )}
              <Link
                to="/library"
                draggable={false}
                {...stylex.props(styles.more)}
              >
                查看全部
              </Link>
            </div>
          </div>
          {tracksLoading ? (
            <HomeLoading label="每日推荐" />
          ) : tracksError ? (
            <HomeError label="每日推荐" />
          ) : visibleTracks.length > 0 ? (
            <div
              data-testid="home-track-grid"
              {...stylex.props(styles.trackGrid)}
            >
              {visibleTracks.map((track) => (
                <LocalTrackCard key={track.id} track={track} tracks={tracks} />
              ))}
            </div>
          ) : (
            <HomeEmpty icon="musicalNotes">
              <strong>音乐库为空</strong>
              <p>添加本地音乐后，这里会展示可播放的曲目。</p>
              <Link to="/settings/library" draggable={false}>
                前往音乐库设置
              </Link>
            </HomeEmpty>
          )}
        </section>

        <section aria-labelledby="home-playlists">
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2 id="home-playlists" {...stylex.props(styles.sectionTitle)}>
                推荐歌单
              </h2>
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
            <HomeLoading label="推荐歌单" />
          ) : playlistsError ? (
            <HomeError label="推荐歌单" />
          ) : visiblePlaylists.length > 0 ? (
            <div {...stylex.props(styles.playlistGrid)}>
              {visiblePlaylists.map((playlist) => (
                <PlaylistTile key={playlist.id} playlist={playlist} />
              ))}
            </div>
          ) : (
            <HomeEmpty icon="playlist">
              <strong>还没有本地歌单</strong>
              <p>可以手动创建歌单，也可导入包含 .m3u 文件的音乐目录。</p>
              <Link to="/playlists" draggable={false}>
                创建歌单
              </Link>
            </HomeEmpty>
          )}
        </section>

        <section aria-labelledby="home-online-recommendations">
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2
                id="home-online-recommendations"
                {...stylex.props(styles.sectionTitle)}
              >
                在线推荐
              </h2>
            </div>
          </div>
          <UnavailableService
            label="每日在线推荐"
            message="在线歌曲和推荐歌单需要经服务契约验证并接入；当前不会显示虚构内容。"
          />
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
    padding: {
      default: '20px',
      '@media (max-width: 899px)': '20px',
      '@media (max-width: 599px)': '20px 14px',
    },
    display: 'flex',
    flexDirection: 'column',
    rowGap: '34px',
  },
  pageHeading: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '24px',
    rowGap: '12px',
    flexWrap: 'wrap',
  },
  pageTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '30px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  visuallyHidden: {
    width: '1px',
    height: '1px',
    position: 'absolute',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
  recommendations: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 699px)': '1fr',
    },
    rowGap: '18px',
    columnGap: '18px',
  },
  recommendationCard: {
    minWidth: 0,
    minHeight: '200px',
    padding: '22px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexDirection: 'column',
    rowGap: '18px',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: '0 10px 20px rgba(36, 59, 89, 0.08)',
  },
  recommendationIcon: {
    width: '58px',
    height: '58px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent-contrast)',
    borderRadius: '8px',
    backgroundColor: 'var(--accent)',
  },
  recommendationCopy: {
    minWidth: 0,
  },
  recommendationTitle: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '20px',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  recommendationMessage: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  recommendationAction: {
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
  sectionHeading: {
    marginBottom: '18px',
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
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '12px',
    rowGap: '8px',
    flexWrap: 'wrap',
  },
  queueAction: {
    minHeight: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '6px',
    paddingBlock: '7px',
    paddingInline: '10px',
    color: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '7px',
    backgroundColor: {
      default: 'var(--accent-subtle)',
      ':hover': 'var(--surface-raised)',
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 700,
    lineHeight: 1.15,
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  more: {
    flexShrink: 0,
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 750,
    textDecorationLine: 'none',
  },
  trackGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(5, minmax(0, 1fr))',
      '@media (max-width: 1250px)': 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 1020px)': 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 767px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 449px)': '1fr',
    },
    rowGap: '12px',
    columnGap: '12px',
  },
  trackCard: {
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
    borderColor: 'transparent',
    borderRadius: '8px',
    boxShadow: {
      default: '0 6px 18px rgba(36, 59, 89, 0.06)',
      ':hover': '0 12px 26px rgba(36, 59, 89, 0.14)',
    },
    cursor: 'pointer',
    transition: {
      default:
        'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-2px)',
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
  playlistGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(auto-fill, minmax(178px, 1fr))',
      '@media (max-width: 599px)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: '18px',
    columnGap: '18px',
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
  playlistArtwork: {
    aspectRatio: '1',
    position: 'relative',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundImage:
      'linear-gradient(145deg, var(--accent-subtle), var(--surface-raised) 64%)',
    boxShadow: {
      default: '0 9px 20px rgba(36, 59, 89, 0.08)',
      ':hover': '0 15px 28px rgba(36, 59, 89, 0.16)',
    },
  },
  playlistDisc: {
    width: '72px',
    height: '72px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    boxShadow: '0 10px 22px color-mix(in srgb, var(--accent) 28%, transparent)',
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
  emptySection: {
    minHeight: '180px',
    padding: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '8px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-subtle)',
  },
  loadingSection: {
    minHeight: '180px',
    padding: '28px',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
  },
  loadingLine: {
    width: '58%',
    height: '14px',
    borderRadius: '4px',
    backgroundColor: 'var(--surface-sunken)',
  },
  loadingLineWide: {
    width: '86%',
  },
  loadingLineShort: {
    width: '38%',
  },
  errorSection: {
    minHeight: '180px',
    padding: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '8px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
  },
  serviceUnavailable: {
    minHeight: '180px',
    padding: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    rowGap: '8px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--accent-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-raised)',
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
});
