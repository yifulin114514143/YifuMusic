import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useCallback } from 'react';

import ButtonIcon from '../elements/ButtonIcon';
import type { Track } from '../generated/typings';
import player from '../lib/player';
import Cover from './Cover';

type Props = {
  index: number;
  track: Track;
  queueCursor: number;
};

export default function QueueListItem(props: Props) {
  const { track } = props;
  const { t } = useLingui();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({
    id: track.id,
    data: {
      type: 'queue-track',
    },
  });

  const itemStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const remove = useCallback(() => {
    player.removeFromQueue(props.index);
  }, [props.index]);

  const play = useCallback(async () => {
    await player.startFromQueue(props.queueCursor + props.index + 1);
  }, [props.index, props.queueCursor]);

  return (
    <li
      {...stylex.props(
        styles.queueItem,
        props.index > 0 && styles.queueItemWithTopBorder,
        stylex.defaultMarker(),
      )}
      ref={setNodeRef}
      style={itemStyle}
      onDoubleClick={play}
    >
      <div {...stylex.props(styles.queueItemCover)}>
        <Cover track={track} iconSize={12} />
      </div>
      <div {...stylex.props(styles.queueItemInfo)}>
        <div title={track.title} {...stylex.props(styles.queueItemInfoTitle)}>
          {track.title}
        </div>
        <div
          title={`${track.artists.join(', ')} - ${track.album}`}
          {...stylex.props(styles.queueItemInfoOtherInfos)}
        >
          <span>{track.artists.join(', ')}</span> - <span>{track.album}</span>
        </div>
      </div>
      <div {...stylex.props(styles.queueItemActions)}>
        <ButtonIcon
          ref={setActivatorNodeRef}
          icon="gripVertical"
          iconSize={16}
          label={t`Reorder ${track.title}`}
          {...attributes}
          {...listeners}
          xstyle={styles.queueItemDragHandle}
        />
        <ButtonIcon
          icon="play"
          iconSize={16}
          label={t`Play ${track.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void play();
          }}
          xstyle={styles.queueItemAction}
        />
        <ButtonIcon
          icon="trash"
          iconSize={16}
          label={t`Remove from queue`}
          aria-label={t`Remove ${track.title} from queue`}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            remove();
          }}
          xstyle={styles.queueItemRemove}
        />
      </div>
    </li>
  );
}

const styles = stylex.create({
  queueItem: {
    display: 'flex',
    flexWrap: 'nowrap',
    width: '100%',
    position: 'relative',
    cursor: 'pointer',
    alignItems: 'center',
    backgroundColor: {
      ':hover': 'var(--surface-hover)',
    },
  },
  queueItemWithTopBorder: {
    borderTopWidth: '1px',
    borderTopStyle: 'dashed',
    borderTopColor: 'var(--border-color)',
  },
  queueItemCover: {
    margin: '8px',
    width: '32px',
    aspectRatio: '1',
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    fontSize: '16px',
  },
  queueItemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
  },
  queueItemInfoTitle: {
    fontWeight: 'bold',
    marginBottom: '4px',
    paddingRight: '10px',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  queueItemInfoOtherInfos: {
    paddingRight: '10px',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    opacity: 0.7,
    fontSize: '0.875rem',
  },
  queueItemActions: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    columnGap: '2px',
    paddingRight: '5px',
  },
  queueItemAction: {
    color: 'var(--text-primary)',
  },
  queueItemDragHandle: {
    color: 'var(--text-secondary)',
    cursor: 'grab',
  },
  queueItemRemove: {
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--danger-color)',
    },
  },
});
