import * as stylex from '@stylexjs/stylex';

import type { Track } from '../generated/typings';
import ButtonPlaybackMode from './ButtonPlaybackMode';
import ButtonShuffle from './ButtonShuffle';
import Cover from './Cover';
import PlayingBarInfos from './PlayingBarInfo';

type Props = {
  trackPlaying: Track;
};

export default function PlayingBar(props: Props) {
  const trackPlaying = props.trackPlaying;

  return (
    <div {...stylex.props(styles.playingBar)}>
      <div {...stylex.props(styles.playingBarCover)}>
        <Cover track={trackPlaying} noHorizontalBorder iconSize={16} />
      </div>
      <PlayingBarInfos trackPlaying={trackPlaying} />
      <div {...stylex.props(styles.playerOptions)}>
        <ButtonPlaybackMode />
        <ButtonShuffle />
      </div>
    </div>
  );
}

const styles = stylex.create({
  playingBar: {
    display: 'flex',
    alignItems: 'center',
    textAlign: 'left',
    height: '100%',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    columnGap: '8px',
  },
  playingBarCover: {
    flexShrink: 0,
    width: {
      default: '56px',
      '@media (max-width: 599px)': '40px',
    },
    height: {
      default: '56px',
      '@media (max-width: 599px)': '40px',
    },
    aspectRatio: '1',
    overflow: 'hidden',
    borderRadius: 'var(--radius-sm)',
    fontSize: '28px',
  },
  playerOptions: {
    flexShrink: 0,
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: '2px',
    display: {
      default: 'flex',
      '@media (max-width: 699px)': 'none',
    },
  },
});
