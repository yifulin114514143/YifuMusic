import { Slider } from '@base-ui/react/slider';
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

  const elapsed = usePlayingTrackCurrentTime();
  const duration = usePlayerState((state) => state.duration);
  const max = duration ?? 1;
  const disabled = duration === null || duration <= 0;
  const [previewTime, setPreviewTime] = useState(elapsed);
  const [isDragging, setIsDragging] = useState(false);

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
      setIsDragging(false);
      setPreviewTime(Math.max(0, Math.min(value, max)));
      player.setCurrentTime(value);
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

      const time = (percent * (duration ?? 0)) / 100;

      setTooltipTargetTime(time);
      setTooltipX(percent);
    },
    [duration],
  );

  const hideTooltip = useCallback(() => {
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
    >
      <Slider.Control
        {...stylex.props(styles.trackRoot)}
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
        <Slider.Thumb aria-label="播放进度" />
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
    height: '7px',
    transform: 'translateY(4px)',
    outline: {
      ':has(:focus-visible)': '2px solid var(--focus-color)',
    },
  },
  trackProgress: {
    display: 'block',
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--header-bg)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
  },
  trackRange: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'var(--main-color)',
    boxShadow: 'inset 0 0 0 1px rgba(0 0 0 / 0.2)',
  },
  progressTooltip: {
    position: 'absolute',
    backgroundColor: 'var(--background)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    fontSize: '10px',
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: '5px',
    paddingRight: '5px',
    bottom: '10px',
    zIndex: 1,
    transform: 'translateX(-11px)',
    pointerEvents: 'none',
    '::before': {
      content: '""',
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderBottomWidth: 0,
      top: '16px',
      left: '5px',
      borderTopColor: 'var(--border-color)',
      borderWidth: '6px',
    },
    '::after': {
      content: '""',
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderBottomWidth: 0,
      top: '15px',
      left: '6px',
      borderTopColor: 'var(--background)',
      borderWidth: '5px',
    },
  },
});
