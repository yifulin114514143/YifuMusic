import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';

export default function PlayerControls() {
  const isPaused = usePlayerState((state) => state.isPaused);
  const { t } = useLingui();

  return (
    <div {...stylex.props(styles.playerControls)}>
      <ButtonIcon
        icon="skipBack"
        iconSize={20}
        label={t`Previous`}
        onClick={() => player.previous()}
        xstyle={styles.controlButton}
      />
      <ButtonIcon
        icon={isPaused ? 'play' : 'pause'}
        iconSize={24}
        label={isPaused ? t`Play` : t`Pause`}
        onClick={() => player.playPause()}
        xstyle={styles.playPause}
      />
      <ButtonIcon
        icon="skipForward"
        iconSize={20}
        label={t`Next`}
        onClick={() => player.next()}
        xstyle={styles.controlButton}
      />
    </div>
  );
}

const styles = stylex.create({
  playerControls: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    rowGap: '2px',
    columnGap: '2px',
  },
  controlButton: {
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    borderRadius: '999px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
      ':active': 'transparent',
    },
    transform: {
      ':hover': 'scale(1.1)',
      ':active': 'scale(0.96)',
    },
  },
  playPause: {
    width: '42px',
    height: '42px',
    minWidth: '42px',
    minHeight: '42px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
      ':active': 'transparent',
    },
    borderRadius: '999px',
    transform: {
      ':hover': 'scale(1.12)',
      ':active': 'scale(0.96)',
    },
  },
});
