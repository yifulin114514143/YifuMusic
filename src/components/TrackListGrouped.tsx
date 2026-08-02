import { Plural, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useImperativeHandle, useRef } from 'react';

import Scrollable from '../elements/Scrollable';
import type { TrackGroup } from '../generated/typings';
import useAllTracks from '../hooks/useAllTracks';
import { parseDuration } from '../hooks/useFormattedDuration';
import usePlayingTrackID from '../hooks/usePlayingTrackID';
import type { TrackListVirtualizer } from '../types/museeks';
import Cover from './Cover';
import TrackRow, { type TrackRowEvents } from './TrackRow';

/** ----------------------------------------------------------------------------
 * Group-based layout for TrackList:
 *  - Does NOT use a virtual list (but it should)
 *  - Non-reorderable
 * -------------------------------------------------------------------------- */

type Props = {
  ref: React.RefObject<TrackListVirtualizer | null>;
  trackGroups: TrackGroup[];
  selectedTracks: Set<string>;
  initialOffset: number;
  rowHeight: number;
  showArtistInTitle?: boolean;
} & TrackRowEvents;

export default function TrackListGroupedLayout(props: Props) {
  const { ref, trackGroups, rowHeight, showArtistInTitle, ...rest } = props;
  const { t } = useLingui();

  const tracks = useAllTracks(trackGroups);

  const innerScrollableRef = useRef<HTMLDivElement>(null);

  // Passes the ref back to the master component for interaction with the
  // scrollable view
  useImperativeHandle(ref, () => {
    return {
      scrollElement: innerScrollableRef.current,
      scrollToIndex: (index: number) => {
        if (innerScrollableRef.current) {
          const track = tracks[index];
          // not super idiomatic, but works eh
          document
            .querySelector(`[data-track-id="${track.id}"]`)
            ?.scrollIntoView({ block: 'nearest' });
        }
      },
    } satisfies TrackListVirtualizer;
  }, [tracks]);

  return (
    <Scrollable
      ref={innerScrollableRef}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 音轨列表支持多选与键盘操作，不能替换为原生 select。
      role="listbox"
      aria-label={t`Track list`}
      aria-multiselectable="true"
    >
      {trackGroups.map((tracksGroup) => {
        return (
          <TrackListGroup
            // Label should be unique due to how the tracks are grouped from get_artist_tracks()
            key={tracksGroup.label}
            tracksGroup={tracksGroup}
            rowHeight={rowHeight}
            showArtistInTitle={showArtistInTitle}
            {...rest}
          />
        );
      })}
    </Scrollable>
  );
}

type TrackListGroupProps = {
  tracksGroup: TrackGroup;
  selectedTracks: Set<string>;
  rowHeight: number;
  showArtistInTitle?: boolean;
} & TrackRowEvents;

function TrackListGroup(props: TrackListGroupProps) {
  const {
    selectedTracks,
    rowHeight,
    showArtistInTitle,
    onTrackSelect,
    onContextMenu,
    onMoreActions,
    onPlaybackStart,
  } = props;
  const { tracks, label, year, genres, duration } = props.tracksGroup;
  const trackPlayingID = usePlayingTrackID();

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div
      {...stylex.props(styles.group)}
      data-track-group={encodeURIComponent(label)}
    >
      <aside {...stylex.props(styles.aside)}>
        {/** Instead of the first one, maybe get the first track within the album to hold a cover? */}
        <Cover track={tracks[0]} iconSize={36} />
        <h3 {...stylex.props(styles.label)}>{label}</h3>
        <div {...stylex.props(styles.metadata)}>
          <div>
            {year}
            {genres.length > 0 && <span> - {genres.join(', ')}</span>}
          </div>
          <div>
            <Plural value={tracks.length} one="# track" other="# tracks" />,{' '}
            {parseDuration(duration)}
          </div>
        </div>
      </aside>
      <ul {...stylex.props(styles.rows)}>
        {tracks.map((track, index) => {
          return (
            <TrackRow
              key={track.id}
              selected={selectedTracks.has(track.id)}
              track={track}
              isPlaying={trackPlayingID === track.id}
              index={index}
              onTrackSelect={onTrackSelect}
              onContextMenu={onContextMenu}
              onMoreActions={onMoreActions}
              onPlaybackStart={onPlaybackStart}
              draggable={false}
              hasSelectedAbove={
                index > 0 && selectedTracks.has(tracks[index - 1].id)
              }
              simplified={true}
              showArtistInTitle={showArtistInTitle}
              style={{ height: `${rowHeight}px` }} // Figure out virtualization for grouped stuff
            />
          );
        })}
      </ul>
    </div>
  );
}

const styles = stylex.create({
  group: {
    display: 'flex',
    flexDirection: {
      default: 'column',
      '@media (min-width: 1400px)': 'row',
    },
    rowGap: {
      default: '16px',
      '@media (min-width: 1400px)': '24px',
    },
    columnGap: {
      default: '16px',
      '@media (min-width: 1400px)': '24px',
    },
    padding: {
      default: '16px',
      '@media (min-width: 1400px)': '24px',
    },
    alignItems: 'flex-start',
    position: 'relative',
  },
  aside: {
    width: {
      default: '100%',
      '@media (min-width: 1400px)': '240px',
    },
    position: {
      default: 'static',
      '@media (min-width: 1400px)': 'sticky',
    },
    top: {
      default: 'auto',
      '@media (min-width: 1400px)': '24px',
    },
    display: 'flex',
    flexDirection: {
      default: 'row',
      '@media (min-width: 1400px)': 'column',
    },
    flexWrap: {
      default: 'wrap',
      '@media (min-width: 1400px)': 'nowrap',
    },
    alignItems: {
      default: 'center',
      '@media (min-width: 1400px)': 'stretch',
    },
    rowGap: '8px',
    columnGap: '8px',
    flexShrink: 0,
  },
  label: {
    fontSize: {
      default: '1.125rem',
      '@media (min-width: 1400px)': '1.4rem',
    },
    fontWeight: 'bold',
    margin: 0,
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metadata: {
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: {
      default: 'row',
      '@media (min-width: 1400px)': 'column',
    },
    width: {
      default: '100%',
      '@media (min-width: 1400px)': 'auto',
    },
    rowGap: '4px',
    columnGap: '4px',
  },
  rows: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
});
