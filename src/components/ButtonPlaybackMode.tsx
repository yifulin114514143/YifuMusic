import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';

export default function ButtonPlaybackMode() {
  const mode = usePlayerState((state) => state.playbackMode);
  const { t } = useLingui();
  const label =
    mode === 'repeat-one'
      ? t`Playback mode: Repeat one`
      : mode === 'repeat-all'
        ? t`Playback mode: Repeat all`
        : t`Playback mode: Sequential`;
  const pressed =
    mode === 'repeat-one' ? 'mixed' : mode === 'repeat-all' ? true : false;

  return (
    <ButtonIcon
      icon={mode === 'repeat-one' ? 'repeatOne' : 'repeat'}
      iconSize={20}
      label={label}
      onClick={() => void player.toggleRepeat()}
      isActive={mode === 'repeat-one' || mode === 'repeat-all'}
      aria-pressed={pressed}
      {...stylex.props(styles.button)}
    />
  );
}

const styles = stylex.create({
  button: {
    flexShrink: 0,
  },
});
