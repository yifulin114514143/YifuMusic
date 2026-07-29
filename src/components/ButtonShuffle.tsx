import { useLingui } from '@lingui/react/macro';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';

export default function ButtonShuffle() {
  const isShuffle = usePlayerState((state) => state.playbackMode === 'shuffle');
  const { t } = useLingui();

  return (
    <ButtonIcon
      icon="shuffle"
      iconSize={20}
      label={t`Shuffle`}
      onClick={() => void player.toggleShuffle()}
      isActive={isShuffle}
      aria-pressed={isShuffle}
    />
  );
}
