import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';

export default function ButtonShuffle() {
  const isShuffle = usePlayerState((state) => state.playbackMode === 'shuffle');

  return (
    <ButtonIcon
      icon="shuffle"
      iconSize={20}
      label="随机播放"
      onClick={() => void player.toggleShuffle()}
      isActive={isShuffle}
      aria-pressed={isShuffle}
    />
  );
}
