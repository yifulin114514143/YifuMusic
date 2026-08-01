import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import Link from '../elements/Link';
import type { Track } from '../generated/typings';
import useFormattedDuration from '../hooks/useFormattedDuration';
import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrackCurrentTime from '../hooks/usePlayingTrackCurrentTime';
import { useAppShell } from './AppShellContext';

type Props = {
  trackPlaying: Track;
};

export default function PlayingBarInfo(props: Props) {
  const { trackPlaying } = props;
  const { t } = useLingui();
  const { openNowPlaying } = useAppShell();
  const elapsed = usePlayingTrackCurrentTime();
  const duration = usePlayerState((state) => state.duration);
  const formattedElapsed = useFormattedDuration(
    Math.min(duration ?? elapsed, elapsed),
  );
  const formattedDurationValue = useFormattedDuration(duration);
  const formattedDuration =
    duration === null ? '--:--' : formattedDurationValue;

  return (
    <div {...stylex.props(styles.playingBarInfo)}>
      <div {...stylex.props(styles.playingBarInfoMetas)}>
        <div {...stylex.props(styles.metas)}>
          <button
            aria-label={t`Open now playing`}
            title={t`Open now playing`}
            type="button"
            onClick={(event) => openNowPlaying(event.currentTarget)}
            {...stylex.props(styles.openNowPlaying)}
          >
            <strong
              title={trackPlaying.title}
              {...stylex.props(styles.metadata, styles.metadataTitle)}
            >
              {trackPlaying.title}
            </strong>
          </button>
          <div
            title={`${trackPlaying.artists.join(', ')} — ${trackPlaying.album}`}
            {...stylex.props(styles.metadata)}
          >
            <Link
              inheritColor
              type="normal"
              linkOptions={
                trackPlaying.is_compilation
                  ? {
                      to: '/artists/presets/compilations',
                      search: { focused_album: trackPlaying.album },
                    }
                  : {
                      to: '/artists/$artistID',
                      params: { artistID: trackPlaying.album_artist },
                    }
              }
            >
              {trackPlaying.artists.join(', ')}
            </Link>
            &nbsp;—&nbsp;
            <Link
              inheritColor
              type="normal"
              linkOptions={
                trackPlaying.is_compilation
                  ? {
                      to: '/artists/presets/compilations',
                      search: { focused_album: trackPlaying.album },
                    }
                  : {
                      to: '/artists/$artistID',
                      params: { artistID: trackPlaying.album_artist },
                      search: { focused_album: trackPlaying.album },
                    }
              }
            >
              {trackPlaying.album}
            </Link>
          </div>
          <div {...stylex.props(styles.duration)}>
            <span>{formattedElapsed}</span>
            <span aria-hidden="true">/</span>
            <span>{formattedDuration}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = stylex.create({
  playingBarInfo: {
    flexGrow: '0',
    flexShrink: '1',
    flexBasis: '300px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
    paddingInline: 0,
  },
  playingBarInfoMetas: {
    rowGap: '2px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  metas: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    verticalAlign: 'middle',
    textAlign: 'left',
  },
  metadataTitle: {
    fontWeight: 'var(--bold)',
    marginBottom: '2px',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  openNowPlaying: {
    minWidth: 0,
    padding: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  metadata: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  duration: {
    display: 'flex',
    alignItems: 'center',
    rowGap: '4px',
    columnGap: '4px',
    marginTop: '3px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
});
