import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

import TrackListHeaderCell from './TrackListHeaderCell';

type Props = {
  sortable?: boolean;
};

export default function TrackListHeader({ sortable = true }: Props) {
  const { t } = useLingui();

  return (
    <div
      {...stylex.props(styles.trackListHeader)}
      role="group"
      aria-label={t`Track list sorting options`}
    >
      <TrackListHeaderCell
        xstyle={styles.cellTrackPlaying}
        title="&nbsp;"
        sortBy={null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellTrack}
        title={t`Title`}
        sortBy={sortable ? 'Title' : null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellArtist}
        title={t`Artist`}
        sortBy={sortable ? 'Artist' : null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellAlbum}
        title={t`Album`}
        sortBy={sortable ? 'Album' : null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellDuration}
        title={t`Duration`}
        sortBy={sortable ? 'Duration' : null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellGenre}
        title={t`Genre`}
        sortBy={sortable ? 'Genre' : null}
      />
      <TrackListHeaderCell
        xstyle={styles.cellActions}
        title={t`More actions`}
        sortBy={null}
      />
    </div>
  );
}

const styles = stylex.create({
  trackListHeader: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-strong)',
    color: 'var(--tracks-header-color)',
    backgroundColor: 'var(--tracks-header-bg)',
    display: 'flex',
    width: '100%',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  },
  cellTrackPlaying: {
    width: '40px',
  },
  cellTrack: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  },
  cellArtist: {
    width: '20%',
  },
  cellAlbum: {
    width: '20%',
  },
  cellDuration: {
    width: '95px',
    minWidth: '95px',
  },
  cellGenre: {
    width: '20%',
    display: {
      default: 'none',
      '@media (min-width: 1400px)': 'block',
    },
  },
  cellActions: {
    width: '40px',
  },
});
