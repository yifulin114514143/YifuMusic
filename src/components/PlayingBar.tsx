import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import type { Track } from '../generated/typings';
import { useAppShell } from './AppShellContext';
import Cover from './Cover';
import Icon from './Icon';
import PlayingBarInfos from './PlayingBarInfo';

type Props = {
  trackPlaying: Track;
};

export default function PlayingBar(props: Props) {
  const trackPlaying = props.trackPlaying;
  const { t } = useLingui();
  const { openNowPlaying } = useAppShell();

  return (
    <div {...stylex.props(styles.playingBar)}>
      <button
        aria-label={t`Open now playing`}
        data-testid="open-now-playing-button"
        title={t`Open now playing`}
        type="button"
        onClick={(event) => openNowPlaying(event.currentTarget)}
        {...stylex.props(styles.playingBarCover)}
      >
        <Cover track={trackPlaying} noHorizontalBorder iconSize={16} />
        <span aria-hidden="true" {...stylex.props(styles.coverOverlay)}>
          <Icon name="chevronUp" size={20} />
        </span>
      </button>
      <PlayingBarInfos trackPlaying={trackPlaying} />
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
    columnGap: '10px',
  },
  playingBarCover: {
    flexShrink: 0,
    width: {
      default: '60px',
      '@media (max-width: 599px)': '40px',
    },
    height: {
      default: '60px',
      '@media (max-width: 599px)': '40px',
    },
    aspectRatio: '1',
    overflow: 'hidden',
    padding: 0,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: '10px',
    fontSize: '28px',
    position: 'relative',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  coverOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
    opacity: {
      default: 0,
      ':hover': 1,
      ':focus-visible': 1,
    },
    transition: 'opacity 180ms ease-out',
  },
});
