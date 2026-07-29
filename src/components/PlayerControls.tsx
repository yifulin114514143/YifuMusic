import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';
import VolumeControl from './VolumeControl';

export default function PlayerControls() {
  const isPaused = usePlayerState((state) => state.isPaused);
  const { t } = useLingui();

  return (
    <div {...stylex.props(styles.playerControls)}>
      <ButtonIcon
        icon="skipBack"
        iconSize={16}
        label={t`Previous`}
        onClick={() => player.previous()}
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
        iconSize={16}
        label={t`Next`}
        onClick={() => player.next()}
      />
      <VolumeControl />
    </div>
  );
}

const styles = stylex.create({
  playerControls: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    rowGap: '8px',
    columnGap: '8px',
  },
  playPause: {
    minWidth: '40px',
    minHeight: '40px',
    color: 'var(--accent-contrast)',
    backgroundColor: {
      default: 'var(--accent)',
      ':hover': 'var(--accent)',
      ':active': 'var(--accent)',
    },
    borderRadius: '999px',
  },
});
