import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import type { PlaybackMode } from '../lib/playback-mode';
import player from '../lib/player';
import Icon from './Icon';

export default function ButtonPlaybackMode() {
  const mode = usePlayerState((state) => state.playbackMode);
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const modeOptions: Array<{
    icon: 'repeat' | 'repeatOne' | 'shuffle';
    label: string;
    value: PlaybackMode;
  }> = [
    {
      icon: 'repeat',
      label: t`Playback mode: Sequential`,
      value: 'sequential',
    },
    {
      icon: 'repeat',
      label: t`Playback mode: Repeat all`,
      value: 'repeat-all',
    },
    {
      icon: 'repeatOne',
      label: t`Playback mode: Repeat one`,
      value: 'repeat-one',
    },
    {
      icon: 'shuffle',
      label: t`播放模式：随机播放`,
      value: 'shuffle',
    },
  ];
  const currentMode = modeOptions.find((option) => option.value === mode);
  const label = currentMode?.label ?? t`Playback mode: Sequential`;
  const pressed =
    mode === 'repeat-one'
      ? 'mixed'
      : mode === 'repeat-all' || mode === 'shuffle';

  const selectMode = (nextMode: PlaybackMode) => {
    setMenuOpen(false);
    void player.setPlaybackMode(nextMode);
  };

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
      onFocus={() => setMenuOpen(true)}
      onMouseEnter={() => setMenuOpen(true)}
      onMouseLeave={() => setMenuOpen(false)}
      {...stylex.props(styles.playbackMode)}
    >
      <ButtonIcon
        aria-controls="player-playback-mode-menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        icon={
          mode === 'shuffle'
            ? 'shuffle'
            : mode === 'repeat-one'
              ? 'repeatOne'
              : 'repeat'
        }
        iconSize={20}
        label={label}
        onClick={() => void player.toggleRepeat()}
        isActive={mode !== 'sequential'}
        aria-pressed={pressed}
        xstyle={styles.button}
      />
      {menuOpen && (
        <div
          aria-label={t`播放模式选项`}
          id="player-playback-mode-menu"
          role="menu"
          {...stylex.props(styles.menu)}
        >
          {modeOptions.map((option) => (
            <button
              key={option.value}
              aria-checked={mode === option.value}
              role="menuitemradio"
              type="button"
              onClick={() => selectMode(option.value)}
              {...stylex.props(
                styles.menuItem,
                mode === option.value && styles.menuItemActive,
              )}
            >
              <Icon name={option.icon} size={16} xstyle={styles.menuItemIcon} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = stylex.create({
  playbackMode: {
    position: 'relative',
    display: 'inline-flex',
    flexShrink: 0,
  },
  button: {
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
  menu: {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: '50%',
    zIndex: 100,
    minWidth: '170px',
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
  menuItem: {
    width: '100%',
    minHeight: '32px',
    paddingBlock: '5px',
    paddingInline: '8px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
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
    whiteSpace: 'nowrap',
  },
  menuItemActive: {
    backgroundColor: 'var(--surface-selected)',
    color: 'var(--main-color)',
    fontWeight: 700,
  },
  menuItemIcon: {
    flexShrink: 0,
  },
});
