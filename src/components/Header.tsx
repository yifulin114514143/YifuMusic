import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrack from '../hooks/usePlayingTrack';
import { useAppShell } from './AppShellContext';
import PlayerControls from './PlayerControls';
import PlayingBar from './PlayingBar';

export default function Header() {
  const { t } = useLingui();
  const queue = usePlayerState((state) => state.queue);
  const trackPlaying = usePlayingTrack();
  const { queueOpen, registerQueueTrigger, toggleQueue } = useAppShell();
  const queueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerQueueTrigger(queueButtonRef.current);
  }, [registerQueueTrigger]);

  return (
    <header aria-label={t`Player`} {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.trackArea)}>
        {trackPlaying !== null ? (
          <PlayingBar trackPlaying={trackPlaying} />
        ) : (
          <div {...stylex.props(styles.emptyTrack)}>{t`No track selected`}</div>
        )}
      </div>
      <div {...stylex.props(styles.controls)}>
        <PlayerControls />
      </div>
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
        xstyle={styles.queueButton}
      />
    </header>
  );
}

const styles = stylex.create({
  header: {
    minHeight: '84px',
    paddingBlock: {
      default: '10px',
      '@media (max-width: 899px)': '8px',
    },
    paddingInline: {
      default: '16px',
      '@media (max-width: 899px)': '10px',
    },
    display: 'grid',
    gridTemplateColumns: {
      default: 'minmax(180px, 1fr) auto auto',
      '@media (max-width: 899px)': 'minmax(0, 1fr) auto auto',
    },
    alignItems: 'center',
    columnGap: {
      default: '16px',
      '@media (max-width: 899px)': '8px',
    },
    backgroundColor: 'var(--surface-raised)',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-subtle)',
  },
  trackArea: {
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  emptyTrack: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  controls: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  queueButton: {
    flexShrink: 0,
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: {
      ':hover': 'var(--surface-hover)',
    },
  },
});
