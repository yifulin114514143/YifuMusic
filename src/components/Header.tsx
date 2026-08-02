import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { Gauge, Heart, ListPlus, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import PlaylistsAPI from '../api/PlaylistsAPI';
import ButtonIcon from '../elements/ButtonIcon';
import type { Playlist } from '../generated/typings';
import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrack from '../hooks/usePlayingTrack';
import DatabaseBridge from '../lib/bridge-database';
import player from '../lib/player';
import toastManager from '../lib/toast-manager';
import { logAndNotifyError } from '../lib/utils';
import { useAppShell } from './AppShellContext';
import ButtonPlaybackMode from './ButtonPlaybackMode';
import DesktopLyricsButton from './DesktopLyricsButton';
import PlayerControls from './PlayerControls';
import PlayingBar from './PlayingBar';
import TrackProgress from './TrackProgress';
import VolumeControl from './VolumeControl';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type OpenPlayerMenu = 'playlist' | 'speed' | null;

export default function Header() {
  const { t } = useLingui();
  const queue = usePlayerState((state) => state.queue);
  const trackPlaying = usePlayingTrack();
  const { queueOpen, registerQueueTrigger, toggleQueue } = useAppShell();
  const queueButtonRef = useRef<HTMLButtonElement>(null);
  const utilitiesRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenPlayerMenu>(null);
  const [playbackRate, setPlaybackRate] = useState(() =>
    player.getPlaybackRate(),
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    registerQueueTrigger(queueButtonRef.current);
  }, [registerQueueTrigger]);

  useEffect(() => {
    const syncPlaybackRate = () => setPlaybackRate(player.getPlaybackRate());

    player.on('stateChange', syncPlaybackRate);
    return () => {
      player.off('stateChange', syncPlaybackRate);
    };
  }, []);

  useEffect(() => {
    if (openMenu === null) return;

    const closeMenu = (event: PointerEvent) => {
      if (utilitiesRef.current?.contains(event.target as Node)) return;
      setOpenMenu(null);
    };

    const closeMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenuWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenuWithEscape);
    };
  }, [openMenu]);

  const togglePlaylistMenu = () => {
    if (trackPlaying === null) return;

    if (openMenu === 'playlist') {
      setOpenMenu(null);
      return;
    }

    setOpenMenu('playlist');
    void DatabaseBridge.getAllPlaylists()
      .then(setPlaylists)
      .catch((error) => {
        setOpenMenu(null);
        logAndNotifyError(error);
      });
  };

  const addTrackToPlaylist = (playlist: Playlist) => {
    if (trackPlaying === null) return;

    void PlaylistsAPI.addTracks(playlist.id, [trackPlaying.id]).then(() => {
      toastManager.add({
        title: t`已将“${trackPlaying.title}”加入“${playlist.name}”`,
        type: 'success',
      });
    });
    setOpenMenu(null);
  };

  const changePlaybackSpeed = (nextRate: number) => {
    setPlaybackRate(nextRate);
    setOpenMenu(null);
    void player.setPlaybackRate(nextRate);
  };

  return (
    <header
      aria-label={t`Player`}
      data-glass-surface="player"
      data-reference-layout="moekoe-player-dock"
      {...stylex.props(styles.header)}
    >
      {trackPlaying !== null && (
        <div {...stylex.props(styles.progressRail)}>
          <TrackProgress trackPlaying={trackPlaying} />
        </div>
      )}

      <div {...stylex.props(styles.playerBar)}>
        <div {...stylex.props(styles.trackArea)}>
          {trackPlaying !== null ? (
            <PlayingBar trackPlaying={trackPlaying} />
          ) : (
            <div
              {...stylex.props(styles.emptyTrack)}
            >{t`No track selected`}</div>
          )}
        </div>

        <div {...stylex.props(styles.controls)}>
          <PlayerControls />
        </div>

        <div ref={utilitiesRef} {...stylex.props(styles.utilities)}>
          {trackPlaying !== null && <DesktopLyricsButton />}
          {trackPlaying !== null && (
            <div {...stylex.props(styles.menuControl)}>
              <button
                aria-controls="player-speed-menu"
                aria-expanded={openMenu === 'speed'}
                aria-label={t`播放速度：${playbackRate} 倍`}
                data-museeks-action
                title={t`播放速度`}
                type="button"
                onClick={() =>
                  setOpenMenu((menu) => (menu === 'speed' ? null : 'speed'))
                }
                {...stylex.props(styles.utilityButton)}
              >
                <Gauge aria-hidden="true" size={20} strokeWidth={2} />
              </button>
              {openMenu === 'speed' && (
                <div
                  aria-label={t`播放速度选项`}
                  id="player-speed-menu"
                  role="menu"
                  {...stylex.props(styles.playerMenu, styles.speedMenu)}
                >
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      aria-checked={playbackRate === speed}
                      role="menuitemradio"
                      type="button"
                      onClick={() => changePlaybackSpeed(speed)}
                      {...stylex.props(
                        styles.playerMenuItem,
                        playbackRate === speed && styles.playerMenuItemActive,
                      )}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {trackPlaying !== null && (
            <button
              aria-label={t`收藏歌曲（暂未实现）`}
              data-museeks-action
              title={t`收藏歌曲`}
              type="button"
              onClick={() =>
                toastManager.add({
                  title: t`收藏功能暂未实现`,
                  type: 'warning',
                })
              }
              {...stylex.props(styles.utilityButton)}
            >
              <Heart aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          )}
          {trackPlaying !== null && (
            <div {...stylex.props(styles.menuControl)}>
              <button
                aria-controls="player-playlist-menu"
                aria-expanded={openMenu === 'playlist'}
                aria-label={t`加入歌单`}
                data-museeks-action
                title={t`加入歌单`}
                type="button"
                onClick={togglePlaylistMenu}
                {...stylex.props(styles.utilityButton)}
              >
                <ListPlus aria-hidden="true" size={20} strokeWidth={2} />
              </button>
              {openMenu === 'playlist' && (
                <div
                  aria-label={t`选择歌单`}
                  id="player-playlist-menu"
                  role="menu"
                  {...stylex.props(styles.playerMenu, styles.playlistMenu)}
                >
                  {playlists.length === 0 ? (
                    <span {...stylex.props(styles.playerMenuEmpty)}>
                      {t`还没有可加入的歌单`}
                    </span>
                  ) : (
                    playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        role="menuitem"
                        title={playlist.name}
                        type="button"
                        onClick={() => addTrackToPlaylist(playlist)}
                        {...stylex.props(styles.playerMenuItem)}
                      >
                        {playlist.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {trackPlaying !== null && (
            <button
              aria-label={t`分享歌曲（暂未实现）`}
              data-museeks-action
              title={t`分享歌曲`}
              type="button"
              onClick={() =>
                toastManager.add({
                  title: t`分享功能暂未实现`,
                  type: 'warning',
                })
              }
              {...stylex.props(styles.utilityButton)}
            >
              <Share2 aria-hidden="true" size={20} strokeWidth={2} />
            </button>
          )}
          <ButtonPlaybackMode />
          <ButtonIcon
            ref={queueButtonRef}
            icon="list"
            iconSize={20}
            label={plural(queue.length, {
              one: 'Queue, # track',
              other: 'Queue, # tracks',
            })}
            aria-pressed={queueOpen}
            isActive={queueOpen}
            onClick={() => toggleQueue(queueButtonRef.current)}
            xstyle={styles.utilityButton}
          />
          <VolumeControl />
        </div>
      </div>
    </header>
  );
}

const styles = stylex.create({
  header: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'var(--glass-surface)',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-subtle)',
    boxShadow: 'var(--shadow-panel), inset 0 1px 0 var(--glass-highlight)',
    backdropFilter: 'var(--glass-backdrop-filter-strong)',
    zIndex: 98,
  },
  playerBar: {
    width: '100%',
    maxWidth: '880px',
    minHeight: '80px',
    boxSizing: 'border-box',
    marginInline: 'auto',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '12px',
  },
  progressRail: {
    position: 'absolute',
    insetInline: 0,
    top: 0,
    height: '6px',
    zIndex: 1,
  },
  trackArea: {
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: '300px',
    display: 'flex',
    alignItems: 'center',
  },
  emptyTrack: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  controls: {
    minWidth: 0,
    flexGrow: 1,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: '4px',
  },
  utilities: {
    minWidth: 0,
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: '4px',
  },
  menuControl: {
    position: 'relative',
    display: 'inline-flex',
    flexShrink: 0,
  },
  utilityButton: {
    flexShrink: 0,
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    color: 'var(--text-secondary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
      ':active': 'transparent',
    },
    transform: {
      ':hover': 'scale(1.12)',
      ':active': 'scale(0.96)',
    },
    transition: 'transform 180ms ease-out',
  },
  playerMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    zIndex: 100,
    boxSizing: 'border-box',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: 'var(--shadow-panel)',
    transform: 'translateX(-50%)',
  },
  speedMenu: {
    minWidth: '70px',
  },
  playlistMenu: {
    minWidth: '160px',
    maxWidth: '260px',
  },
  playerMenuItem: {
    width: '100%',
    minHeight: '32px',
    paddingBlock: '5px',
    paddingInline: '10px',
    overflow: 'hidden',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '6px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
    },
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1.2,
    textAlign: 'left',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  playerMenuItemActive: {
    backgroundColor: 'var(--surface-selected)',
    color: 'var(--main-color)',
    fontWeight: 700,
  },
  playerMenuEmpty: {
    paddingBlock: '7px',
    paddingInline: '10px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
});
