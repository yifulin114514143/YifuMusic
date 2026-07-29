import { Popover } from '@base-ui/react/popover';
import * as stylex from '@stylexjs/stylex';
import { useRef, useState } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import type { PlaybackMode } from '../lib/playback-mode';
import player from '../lib/player';

const modes: Array<{
  value: PlaybackMode;
  label: string;
  icon: 'list' | 'shuffle' | 'repeatOne' | 'repeat';
}> = [
  { value: 'sequential', label: '顺序播放', icon: 'list' },
  { value: 'shuffle', label: '随机播放', icon: 'shuffle' },
  { value: 'repeat-one', label: '单曲循环', icon: 'repeatOne' },
  { value: 'repeat-all', label: '列表循环', icon: 'repeat' },
];

export default function ButtonPlaybackMode() {
  const mode = usePlayerState((state) => state.playbackMode);
  const queueLength = usePlayerState((state) => state.queue.length);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = modes.find((item) => item.value === mode) ?? modes[0];
  const choose = (nextMode: PlaybackMode) => {
    if (nextMode === 'shuffle' && queueLength < 2) return;
    void player.setPlaybackMode(nextMode);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div {...stylex.props(styles.container)}>
        <Popover.Trigger
          render={(triggerProps) => (
            <ButtonIcon
              {...triggerProps}
              ref={buttonRef}
              icon={current.icon}
              iconSize={20}
              label={`播放模式：${current.label}`}
              data-museeks-action
              isActive={mode !== 'sequential'}
            />
          )}
        />
      </div>
      <Popover.Portal>
        <Popover.Positioner side="top" align="end" sideOffset={8}>
          <Popover.Popup
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            aria-label="播放模式"
            initialFocus={() =>
              menuRef.current?.querySelector<HTMLButtonElement>(
                '[aria-checked="true"]',
              ) ?? false
            }
            finalFocus={buttonRef}
            data-museeks-action
            {...stylex.props(styles.menu)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                buttonRef.current?.focus();
                return;
              }
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
              event.preventDefault();
              const items = [
                ...(menuRef.current?.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitemradio"]',
                ) ?? []),
              ].filter((item) => !item.disabled);
              const currentIndex = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const nextIndex =
                (currentIndex +
                  (event.key === 'ArrowDown' ? 1 : -1) +
                  items.length) %
                items.length;
              items[nextIndex]?.focus();
            }}
          >
            {modes.map((item) => {
              const disabled = item.value === 'shuffle' && queueLength < 2;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={item.value === mode}
                  aria-label={
                    disabled ? `${item.label}，单曲队列不可用` : item.label
                  }
                  disabled={disabled}
                  title={disabled ? '单曲队列无法使用随机播放' : item.label}
                  tabIndex={item.value === mode ? 0 : -1}
                  data-museeks-action
                  onClick={() => choose(item.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      choose(item.value);
                    }
                  }}
                  {...stylex.props(styles.item)}
                >
                  {item.label}
                </button>
              );
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const styles = stylex.create({
  container: {
    position: 'relative',
  },
  menu: {
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    minWidth: '120px',
    padding: '4px',
    backgroundColor: 'var(--background)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    boxShadow: '0 5px 12px rgba(0 0 0 / 0.2)',
  },
  item: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    color: 'var(--text)',
    textAlign: 'left',
    paddingTop: '6px',
    paddingBottom: '6px',
    paddingLeft: '8px',
    paddingRight: '8px',
    whiteSpace: 'nowrap',
  },
});
