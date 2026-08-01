import * as stylex from '@stylexjs/stylex';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';

import BackToTop from '../components/BackToTop';
import Cover from '../components/Cover';
import Icon from '../components/Icon';
import TrackList from '../components/TrackList';
import TrackListStates from '../components/TrackListStates';
import View from '../elements/View';
import useFilteredTracks from '../hooks/useFilteredTracks';
import { parseDuration } from '../hooks/useFormattedDuration';
import useGlobalTrackListStatus, {
  useTrackListStatus,
} from '../hooks/useGlobalTrackListStatus';
import player from '../lib/player';
import { allPlaylistsQuery, allTracksQuery, configQuery } from '../lib/queries';
import queryClient from '../lib/query-client';
import type { QueueOrigin } from '../types/museeks';

const QUEUE_ORIGIN: QueueOrigin = { type: 'library' };

export const Route = createFileRoute('/library')({
  component: ViewLibrary,
  loader: async () => {
    await Promise.all([
      queryClient.prefetchQuery(allTracksQuery),
      queryClient.prefetchQuery(allPlaylistsQuery),
    ]);
  },
});

const onlineLibraryActions = [
  { label: '听歌历史', icon: 'musicalNotes' as const },
  { label: '签到', icon: 'plus' as const },
  { label: 'VIP', icon: 'cloud' as const },
  { label: '收藏歌单', icon: 'playlist' as const },
  { label: '收藏专辑', icon: 'playlist' as const },
  { label: '关注歌手', icon: 'musicalNotes' as const },
  { label: '好友', icon: 'musicalNotes' as const },
  { label: '我的云盘', icon: 'cloud' as const },
];

function PreviewTrack(props: {
  track: Parameters<typeof player.start>[0][number];
  tracks: Parameters<typeof player.start>[0];
}) {
  const { track, tracks } = props;

  return (
    <button
      aria-label={`播放 ${track.title}`}
      type="button"
      onClick={() => void player.start(tracks, track.id, QUEUE_ORIGIN)}
      {...stylex.props(styles.previewTrack)}
    >
      <span {...stylex.props(styles.previewCover)}>
        <Cover track={track} iconSize={20} />
      </span>
      <span {...stylex.props(styles.previewCopy)}>
        <strong title={track.title}>{track.title}</strong>
        <small title={track.artists.join(', ')}>
          {track.artists.join(', ')}
        </small>
      </span>
      <span aria-hidden="true" {...stylex.props(styles.previewPlay)}>
        <Icon name="play" size={16} />
      </span>
    </button>
  );
}

function ViewLibrary() {
  const config = useSuspenseQuery(configQuery).data;
  const { data: tracks, isLoading } = useQuery(allTracksQuery);
  const {
    data: playlists,
    isError: isPlaylistsError,
    isLoading: isPlaylistsLoading,
  } = useQuery(allPlaylistsQuery);
  const localPlaylists = playlists ?? [];
  const allTracks = tracks ?? [];
  const filteredTracks = useFilteredTracks(
    allTracks,
    config.library_sort_by,
    config.library_sort_order,
  );
  useGlobalTrackListStatus(filteredTracks);
  const libraryStatus = useTrackListStatus(allTracks);
  const previewTracks = allTracks.slice(0, 15);

  return (
    <View xstyle={styles.view}>
      <main {...stylex.props(styles.page)}>
        <section
          aria-label="本地音乐库概览"
          data-reference-layout="moekoe-library"
          data-testid="library-local-overview"
          {...stylex.props(styles.hero)}
        >
          <span aria-hidden="true" {...stylex.props(styles.heroArt)}>
            <Icon name="musicalNotes" size={36} />
          </span>
          <div {...stylex.props(styles.heroCopy)}>
            <p {...stylex.props(styles.heroEyebrow)}>本地资料库</p>
            <h2 {...stylex.props(styles.heroTitle)}>音乐库</h2>
            <p {...stylex.props(styles.heroDescription)}>
              本机已经导入的真实曲目、专辑与播放列表。
            </p>
            <p {...stylex.props(styles.heroMeta)}>
              {libraryStatus.count} 首音轨 /{' '}
              {parseDuration(libraryStatus.duration)}
            </p>
            <dl {...stylex.props(styles.heroStats)}>
              <div {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>本地曲目</dt>
                <dd
                  data-testid="library-track-count"
                  {...stylex.props(styles.statValue)}
                >
                  {libraryStatus.count}
                </dd>
              </div>
              <div {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>总时长</dt>
                <dd
                  data-testid="library-duration"
                  {...stylex.props(styles.statValue)}
                >
                  {parseDuration(libraryStatus.duration)}
                </dd>
              </div>
              <div {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>本地歌单</dt>
                <dd
                  data-testid="library-playlist-count"
                  {...stylex.props(styles.statValue)}
                >
                  {localPlaylists.length}
                </dd>
              </div>
            </dl>
          </div>
          <div
            aria-label="本地资料库操作"
            {...stylex.props(styles.heroActions)}
          >
            {allTracks.length > 0 && (
              <button
                aria-label="播放全部本地歌曲"
                data-testid="library-play-all"
                title="播放全部"
                type="button"
                onClick={() => {
                  const firstTrack = allTracks[0];
                  if (firstTrack === undefined) return;
                  void player.start(allTracks, firstTrack.id, QUEUE_ORIGIN);
                }}
                {...stylex.props(styles.primaryAction, styles.playAllAction)}
              >
                <Icon name="play" size={16} />
                <span>播放全部</span>
              </button>
            )}
            <Link
              to="/settings/library"
              draggable={false}
              {...stylex.props(styles.primaryAction)}
            >
              管理音乐文件夹
            </Link>
            <Link
              to="/playlists"
              draggable={false}
              {...stylex.props(styles.secondaryAction)}
            >
              查看歌单
            </Link>
          </div>
          <aside
            aria-label="在线功能状态"
            data-testid="library-service-unavailable"
            {...stylex.props(styles.serviceNotice)}
          >
            <span aria-hidden="true" {...stylex.props(styles.serviceIcon)}>
              <Icon name="cloud" size={20} />
            </span>
            <div {...stylex.props(styles.serviceCopy)}>
              <span>在线功能</span>
              <strong>服务接入后可用</strong>
              <p>在线账号、VIP 与听歌历史将在服务契约验证并接入后显示。</p>
            </div>
          </aside>
        </section>

        <section
          aria-labelledby="library-account-actions"
          data-testid="library-account-actions"
          {...stylex.props(styles.accountSection)}
        >
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <p {...stylex.props(styles.accountEyebrow)}>资料 / 账户</p>
              <h2
                id="library-account-actions"
                {...stylex.props(styles.sectionTitle)}
              >
                我的资料库
              </h2>
            </div>
            <span {...stylex.props(styles.accountHint)}>
              在线服务接入后可用
            </span>
          </div>
          <div
            data-testid="library-account-grid"
            {...stylex.props(styles.accountGrid)}
          >
            <Link
              aria-label="打开我的本地歌单"
              title="我的歌单"
              to="/playlists"
              draggable={false}
              {...stylex.props(styles.accountAction, styles.accountActionLocal)}
            >
              <Icon name="playlist" size={20} />
              <span>
                <strong>我的歌单</strong>
                <small>本地歌单可用</small>
              </span>
            </Link>
            <Link
              aria-label="打开本地音乐"
              title="本地音乐"
              to="/local-music"
              draggable={false}
              {...stylex.props(styles.accountAction, styles.accountActionLocal)}
            >
              <Icon name="musicalNotes" size={20} />
              <span>
                <strong>本地音乐</strong>
                <small>{libraryStatus.count} 首本地曲目</small>
              </span>
            </Link>
            {onlineLibraryActions.map((action) => (
              <button
                key={action.label}
                aria-label={`${action.label}，服务接入后可用`}
                aria-disabled="true"
                disabled
                title={`${action.label}：服务接入后可用`}
                type="button"
                {...stylex.props(
                  styles.accountAction,
                  styles.accountActionDisabled,
                )}
              >
                <Icon name={action.icon} size={20} />
                <span>
                  <strong>{action.label}</strong>
                  <small>服务接入后可用</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="library-preview"
          {...stylex.props(styles.previewSection)}
        >
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2 id="library-preview" {...stylex.props(styles.sectionTitle)}>
                我喜欢听
              </h2>
            </div>
            <Link
              to="/settings/library"
              draggable={false}
              {...stylex.props(styles.sectionLink)}
            >
              音乐库设置
            </Link>
          </div>
          {previewTracks.length > 0 ? (
            <div {...stylex.props(styles.previewGrid)}>
              {previewTracks.map((track) => (
                <PreviewTrack key={track.id} track={track} tracks={allTracks} />
              ))}
            </div>
          ) : (
            <div {...stylex.props(styles.emptyPreview)}>
              <Icon name="musicalNotes" size={28} />
              <span>导入本地音乐后，这里会显示可以立即播放的曲目。</span>
            </div>
          )}
        </section>

        <section
          aria-labelledby="library-playlists"
          {...stylex.props(styles.section)}
        >
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2 id="library-playlists" {...stylex.props(styles.sectionTitle)}>
                我的歌单
              </h2>
            </div>
            <Link
              to="/playlists"
              draggable={false}
              data-museeks-action
              {...stylex.props(styles.sectionLink)}
            >
              管理歌单
            </Link>
          </div>
          <div {...stylex.props(styles.playlistGrid)}>
            {isPlaylistsLoading ? (
              <div
                aria-busy="true"
                role="status"
                {...stylex.props(styles.inlineState)}
              >
                正在读取本地歌单...
              </div>
            ) : isPlaylistsError ? (
              <div
                role="alert"
                {...stylex.props(styles.inlineState, styles.inlineError)}
              >
                无法读取本地歌单，请稍后重试。
              </div>
            ) : localPlaylists.length > 0 ? (
              localPlaylists.slice(0, 12).map((playlist) => (
                <Link
                  key={playlist.id}
                  aria-label={`打开歌单：${playlist.name}`}
                  to="/playlists/$playlistID"
                  params={{ playlistID: playlist.id }}
                  draggable={false}
                  data-museeks-action
                  {...stylex.props(styles.playlistTile)}
                >
                  <span
                    aria-hidden="true"
                    {...stylex.props(styles.playlistArt)}
                  >
                    <Icon name="playlist" size={36} />
                  </span>
                  <strong
                    title={playlist.name}
                    {...stylex.props(styles.playlistName)}
                  >
                    {playlist.name}
                  </strong>
                  <span {...stylex.props(styles.playlistMeta)}>
                    {playlist.tracks.length} 首歌
                  </span>
                </Link>
              ))
            ) : (
              <Link
                aria-label="创建歌单"
                to="/playlists"
                draggable={false}
                data-museeks-action
                {...stylex.props(styles.playlistTile, styles.playlistEmptyTile)}
              >
                <span aria-hidden="true" {...stylex.props(styles.playlistArt)}>
                  <Icon name="plus" size={28} />
                </span>
                <strong {...stylex.props(styles.playlistName)}>创建歌单</strong>
                <span {...stylex.props(styles.playlistMeta)}>
                  还没有本地歌单
                </span>
              </Link>
            )}
          </div>
        </section>

        <section
          aria-labelledby="library-tracks"
          {...stylex.props(styles.tracksSection)}
        >
          <div {...stylex.props(styles.sectionHeading)}>
            <div>
              <h2 id="library-tracks" {...stylex.props(styles.sectionTitle)}>
                全部歌曲
              </h2>
            </div>
          </div>
          <TrackListStates isLoading={isLoading} tracks={filteredTracks}>
            <TrackList
              layout="default"
              data={filteredTracks}
              queueOrigin={QUEUE_ORIGIN}
              tracksDensity={config.track_view_density}
              playlists={localPlaylists}
            />
          </TrackListStates>
        </section>
        <BackToTop />
      </main>
    </View>
  );
}

const styles = stylex.create({
  view: {
    padding: 0,
  },
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
  hero: {
    minWidth: 0,
    minHeight: '208px',
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: {
      default: '96px minmax(0, 1fr) auto',
      '@media (max-width: 899px)': '88px minmax(0, 1fr)',
      '@media (max-width: 599px)': '1fr',
    },
    alignItems: 'center',
    columnGap: '20px',
    rowGap: '16px',
    overflow: 'hidden',
    padding: {
      default: '24px',
      '@media (max-width: 599px)': '20px',
    },
    color: '#ffffff',
    borderRadius: '15px',
    backgroundImage:
      'linear-gradient(110deg, var(--surface-raised) 0%, var(--surface-raised) 58%, color-mix(in srgb, var(--accent) 24%, var(--surface-raised)) 100%)',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.18)',
  },
  heroArt: {
    width: '90px',
    height: '90px',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.52)',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.17)',
    boxShadow: '0 12px 26px rgba(32, 17, 62, 0.22)',
  },
  heroCopy: {
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
  },
  heroEyebrow: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.1em',
  },
  heroTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '29px',
    fontWeight: 800,
    lineHeight: 1.2,
  },
  heroDescription: {
    maxWidth: '600px',
    marginTop: '8px',
    marginBottom: 0,
    color: 'rgba(255, 255, 255, 0.89)',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  heroMeta: {
    marginTop: '13px',
    marginBottom: 0,
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 750,
    fontVariantNumeric: 'tabular-nums',
  },
  heroStats: {
    width: 'min(540px, 100%)',
    marginTop: '18px',
    marginBottom: 0,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: '18px',
    rowGap: '8px',
  },
  stat: {
    minWidth: 0,
    display: 'inline-flex',
    alignItems: 'baseline',
    columnGap: '5px',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '11px',
  },
  statValue: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    overflow: 'hidden',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  heroActions: {
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
  primaryAction: {
    paddingBlock: '9px',
    paddingInline: '13px',
    color: 'var(--accent)',
    borderRadius: '7px',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    fontWeight: 750,
    textDecorationLine: 'none',
  },
  playAllAction: {
    minHeight: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '6px',
    borderWidth: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    lineHeight: 1.2,
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  secondaryAction: {
    paddingBlock: '9px',
    paddingInline: '13px',
    color: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.42)',
    borderRadius: '7px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: '13px',
    fontWeight: 700,
    textDecorationLine: 'none',
  },
  serviceNotice: {
    minWidth: 0,
    position: 'relative',
    zIndex: 1,
    gridColumnStart: '2',
    gridColumnEnd: '-1',
    display: 'flex',
    alignItems: 'flex-start',
    columnGap: '10px',
    paddingTop: '12px',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  serviceIcon: {
    width: '36px',
    height: '36px',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  serviceCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '3px',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: '12px',
  },
  previewSection: {
    minWidth: 0,
  },
  accountSection: {
    minWidth: 0,
    padding: '20px',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
  },
  accountEyebrow: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
  },
  accountHint: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
  },
  accountGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(5, minmax(0, 1fr))',
      '@media (max-width: 1024px)': 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 767px)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: '10px',
    columnGap: '10px',
  },
  accountAction: {
    minWidth: 0,
    minHeight: '68px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    color: 'var(--text-primary)',
    textAlign: 'left',
    textDecorationLine: 'none',
    backgroundColor: 'var(--surface-base)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '9px',
    cursor: 'pointer',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  accountActionLocal: {
    borderColor: 'var(--accent-border)',
    backgroundColor: 'var(--accent-subtle)',
  },
  accountActionDisabled: {
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    opacity: 0.72,
  },
  inlineState: {
    minHeight: '96px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    fontSize: '13px',
  },
  inlineError: {
    color: 'var(--danger-color)',
  },
  section: {
    minWidth: 0,
  },
  tracksSection: {
    minWidth: 0,
  },
  sectionHeading: {
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: '20px',
    rowGap: '10px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--accent)',
    fontSize: '27px',
    fontWeight: 800,
    lineHeight: 1.25,
  },
  sectionLink: {
    flexShrink: 0,
    color: 'var(--accent)',
    fontSize: '13px',
    fontWeight: 750,
    textDecorationLine: 'none',
  },
  previewGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 1249px)': 'repeat(4, minmax(0, 1fr))',
      '@media (max-width: 999px)': 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 699px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 449px)': '1fr',
    },
    rowGap: '12px',
    columnGap: '12px',
  },
  previewTrack: {
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
      default: 'transform 180ms ease, box-shadow 180ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-2px)',
    },
  },
  previewCover: {
    width: '54px',
    height: '54px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '8px',
    backgroundColor: 'var(--surface-sunken)',
  },
  previewCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    overflow: 'hidden',
  },
  previewPlay: {
    width: '27px',
    height: '27px',
    position: 'absolute',
    right: '11px',
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
  emptyPreview: {
    minHeight: '154px',
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
    borderRadius: '10px',
    backgroundColor: 'var(--surface-raised)',
  },
  playlistGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(auto-fill, minmax(170px, 1fr))',
      '@media (max-width: 599px)': 'repeat(2, minmax(0, 1fr))',
    },
    rowGap: '20px',
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
  playlistEmptyTile: {},
  playlistArt: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '14px',
    backgroundImage:
      'linear-gradient(145deg, var(--accent-subtle), var(--surface-raised) 72%)',
    boxShadow: {
      default: '0 10px 20px rgba(36, 59, 89, 0.08)',
      ':hover': '0 17px 31px rgba(36, 59, 89, 0.15)',
    },
  },
  playlistName: {
    minWidth: 0,
    marginTop: '10px',
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
});
