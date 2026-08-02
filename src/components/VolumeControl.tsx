import { Slider } from '@base-ui/react/slider';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useCallback, useState } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import { usePlayerState } from '../hooks/usePlayer';
import player from '../lib/player';
import { stopPropagation } from '../lib/utils-events';
import type { IconName } from './Icon';

// Volume easing - http://www.dr-lex.be/info-stuff/volumecontrols.html#about
const SMOOTHING_FACTOR = 2.5;

const smoothifyVolume = (value: number): number => value ** SMOOTHING_FACTOR;
const unsmoothifyVolume = (value: number): number =>
  value ** (1.0 / SMOOTHING_FACTOR);

const getVolumeIcon = (volume: number, muted: boolean): IconName => {
  if (muted) return 'volumeMute';
  if (volume === 0) return 'volumeOff';
  if (volume < 0.33) return 'volumeLow';
  if (volume < 0.67) return 'volumeMedium';
  return 'volumeHigh';
};

export default function VolumeControl() {
  const volume = usePlayerState((state) => state.volume);
  const muted = usePlayerState((state) => state.muted);
  const { t } = useLingui();
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const displayedVolume = unsmoothifyVolume(volume);
  const volumePercent = Math.round(displayedVolume * 100);

  const setPlayerVolume = useCallback((value: number) => {
    const smoothVolume = smoothifyVolume(value);
    void player.unmute();
    player.setVolume(smoothVolume); // Debounced save happens in player
  }, []);

  return (
    <div
      aria-label={t`Volume`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setIsDragging(false);
      }}
      {...stylex.props(styles.volumeControl)}
    >
      <ButtonIcon
        label={muted ? t`取消静音` : t`静音`}
        icon={getVolumeIcon(unsmoothifyVolume(volume), muted)}
        iconSize={16}
        onClick={() => void player.toggleMute()}
        xstyle={styles.volumeControlContainer}
      />
      <div {...stylex.props(styles.sliderWrap)}>
        <span
          aria-hidden="true"
          style={{ left: `${volumePercent}%` }}
          {...stylex.props(
            styles.volumeValue,
            (isHovering || isDragging) && styles.volumeValueVisible,
          )}
        >
          {volumePercent}%
        </span>
        <Slider.Root
          value={displayedVolume}
          // prevent <- / -> keybinding conflicts with player seekbar when volume slider is focused
          onKeyDown={stopPropagation}
          onValueChange={(value) => {
            setIsDragging(true);
            setPlayerVolume(value);
          }}
          onValueCommitted={() => setIsDragging(false)}
          min={0}
          max={1}
          step={0.01}
          {...stylex.props(styles.slider)}
        >
          <Slider.Control
            onPointerDown={() => setIsDragging(true)}
            {...stylex.props(
              styles.sliderRoot,
              muted && styles.faded,
              (isHovering || isDragging) && styles.sliderRootActive,
            )}
          >
            <Slider.Track {...stylex.props(styles.sliderTrack)}>
              <Slider.Indicator {...stylex.props(styles.sliderRange)} />
            </Slider.Track>
            <Slider.Thumb
              aria-label={t`Volume`}
              data-museeks-action
              {...stylex.props(
                styles.sliderThumb,
                (isHovering || isDragging) && styles.sliderThumbVisible,
              )}
            />
          </Slider.Control>
        </Slider.Root>
      </div>
    </div>
  );
}

const styles = stylex.create({
  volumeControl: {
    display: {
      default: 'flex',
      '@media (max-width: 767px)': 'none',
    },
    alignItems: 'center',
    columnGap: '10px',
  },
  volumeControlContainer: {
    width: '32px',
    height: '32px',
    marginLeft: 0,
    paddingBlock: 0,
    paddingInline: 0,
    lineHeight: 1,
    color: 'var(--text-secondary)',
    borderRadius: '999px',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'transparent',
      ':active': 'transparent',
    },
    transform: {
      ':hover': 'scale(1.12)',
      ':active': 'scale(0.96)',
    },
    transition: 'transform 180ms ease-out',
  },
  sliderWrap: {
    position: 'relative',
    width: '100px',
  },
  volumeValue: {
    position: 'absolute',
    bottom: '100%',
    minWidth: '32px',
    paddingBlock: '2px',
    paddingInline: '6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    color: '#ffffff',
    fontSize: '12px',
    lineHeight: 1.4,
    textAlign: 'center',
    opacity: 0,
    pointerEvents: 'none',
    transform: 'translate(-50%, 0)',
    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
    zIndex: 3,
    '::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      bottom: '-4px',
      width: 0,
      height: 0,
      borderLeftWidth: '4px',
      borderRightWidth: '4px',
      borderTopWidth: '4px',
      borderStyle: 'solid',
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: 'rgba(0, 0, 0, 0.72)',
      borderBottomWidth: 0,
      transform: 'translateX(-50%)',
    },
  },
  volumeValueVisible: {
    opacity: 1,
    transform: 'translate(-50%, -8px)',
  },
  slider: { width: '100px' },
  sliderRoot: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    userSelect: 'none',
    touchAction: 'none',
    width: '100px',
    height: '12px',
    cursor: 'pointer',
  },
  sliderRootActive: {
    height: '14px',
  },
  sliderTrack: {
    backgroundColor: 'var(--slider-bg)',
    position: 'relative',
    flexGrow: 1,
    borderRadius: '9999px',
    height: '6px',
  },
  sliderRange: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'var(--main-color)',
    borderRadius: 'var(--border-radius)',
  },
  sliderThumb: {
    display: 'block',
    width: '10px',
    height: '10px',
    backgroundColor: 'white',
    borderRadius: '50%',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'var(--main-color)',
    opacity: 0,
    transition: 'opacity 150ms ease-out',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  sliderThumbVisible: {
    opacity: 1,
  },
  faded: {
    opacity: 0.6,
  },
});
