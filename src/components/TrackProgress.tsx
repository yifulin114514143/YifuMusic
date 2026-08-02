import { Slider } from '@base-ui/react/slider';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useCallback, useEffect, useState } from 'react';

import type { Track } from '../generated/typings';
import useFormattedDuration from '../hooks/useFormattedDuration';
import { usePlayerState } from '../hooks/usePlayer';
import usePlayingTrackCurrentTime from '../hooks/usePlayingTrackCurrentTime';
import player from '../lib/player';

type Props = {
  trackPlaying: Track;
};

export default function TrackProgress(props: Props) {
  const { trackPlaying } = props;
  const { t } = useLingui();

  const elapsed = usePlayingTrackCurrentTime();
  const duration = usePlayerState((state) => state.duration);
  const max = duration ?? 1;
  const disabled = duration === null || duration <= 0;
  const [previewTime, setPreviewTime] = useState(elapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setPreviewTime(0);
    setIsDragging(false);
  }, [trackPlaying.id]);

  useEffect(() => {
    if (!isDragging) setPreviewTime(Math.min(elapsed, max));
  }, [elapsed, isDragging, max]);

  const previewAudioTo = useCallback(
    (value: number) => {
      setIsDragging(true);
      setPreviewTime(Math.max(0, Math.min(value, max)));
    },
    [max],
  );

  const jumpAudioTo = useCallback(
    (value: number) => {
      const target = Math.max(0, Math.min(value, max));
      setIsDragging(false);
      setPreviewTime(target);
      player.setCurrentTime(target);
    },
    [max],
  );

  const [tooltipTargetTime, setTooltipTargetTime] = useState<null | number>(
    null,
  );
  const [tooltipX, setTooltipX] = useState<null | number>(null);

  const showTooltip = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const { offsetX } = e.nativeEvent;
      const barWidth = e.currentTarget.offsetWidth;

      const percent = (offsetX / barWidth) * 100;

      const time = (percent * max) / 100;

      setTooltipTargetTime(time);
      setTooltipX(percent);
    },
    [max],
  );

  const hideTooltip = useCallback(() => {
    setIsHovering(false);
    setTooltipTargetTime(null);
    setTooltipX(null);
  }, []);

  const tooltipContent = useFormattedDuration(tooltipTargetTime);

  return (
    <Slider.Root
      min={0}
      max={max}
      disabled={disabled}
      step={1}
      value={Math.min(previewTime, max)}
      onValueChange={previewAudioTo}
      onValueCommitted={jumpAudioTo}
      {...stylex.props(styles.slider)}
    >
      <Slider.Control
        {...stylex.props(
          styles.trackRoot,
          (isHovering || isDragging) && styles.trackRootExpanded,
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseMoveCapture={showTooltip}
        onMouseLeave={hideTooltip}
      >
        <Slider.Track {...stylex.props(styles.trackProgress)}>
          <Slider.Indicator {...stylex.props(styles.trackRange)} />
          <div
            {...stylex.props(styles.progressTooltip)}
            style={{
              left: `${tooltipX}%`,
              display: tooltipX == null ? 'none' : 'block',
            }}
          >
            {tooltipContent}
          </div>
        </Slider.Track>
        <Slider.Thumb
          aria-label={t`Playback progress`}
          {...stylex.props(
            styles.thumb,
            (isHovering || isDragging) && styles.thumbVisible,
          )}
        />
      </Slider.Control>
    </Slider.Root>
  );
}

const styles = stylex.create({
  trackRoot: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    userSelect: 'none',
    touchAction: 'none',
    width: '100%',
    height: '2px',
    cursor: 'pointer',
    transition: 'height 200ms ease-out',
    outline: {
      ':has(:focus-visible)': '2px solid var(--focus-color)',
    },
  },
  trackRootExpanded: {
    height: '6px',
  },
  trackProgress: {
    display: 'block',
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--progress-bg)',
    borderWidth: 0,
  },
  trackRange: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'var(--main-color)',
    boxShadow: 'none',
  },
  progressTooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    color: '#ffffff',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: '5px',
    paddingRight: '5px',
    bottom: '14px',
    zIndex: 4,
    transform: 'translateX(-50%)',
    pointerEvents: 'none',
    '::before': {
      content: '""',
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderBottomWidth: 0,
      top: '100%',
      left: '50%',
      borderTopColor: 'rgba(0, 0, 0, 0.72)',
      borderWidth: '4px',
      transform: 'translateX(-50%)',
    },
  },
  slider: {
    width: '100%',
    display: 'block',
  },
  thumb: {
    width: '12px',
    height: '12px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'var(--main-color)',
    borderRadius: '999px',
    backgroundColor: 'var(--accent-contrast)',
    opacity: 0,
    transition: 'opacity 200ms ease-out',
  },
  thumbVisible: {
    opacity: 1,
  },
});
