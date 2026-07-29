import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { ask } from '@tauri-apps/plugin-dialog';
import { useCallback, useId, useState } from 'react';

import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import type { Track } from '../generated/typings';
import useDndSensors from '../hooks/useDnDSensors';
import { useTrackListStatus } from '../hooks/useGlobalTrackListStatus';
import player from '../lib/player';
import QueueListItem from './QueueListItem';
import TrackListStatus from './TrackListStatus';

const INITIAL_QUEUE_SIZE = 20;
const DND_MODIFIERS = [restrictToVerticalAxis];

type Props = {
  queue: Track[];
  queueCursor: number;
};

export default function QueueList(props: Props) {
  const { queue, queueCursor } = props;
  const [queueSize, setQueueSize] = useState(INITIAL_QUEUE_SIZE);
  const { t } = useLingui();

  // Get the 20 next tracks displayed
  const shownQueue = queue.slice(queueCursor + 1, queueCursor + 1 + queueSize);
  const hiddenQueue = queue.slice(queueCursor + 1 + queueSize);
  const incomingQueue = queue.slice(queueCursor + 1);

  const status = useTrackListStatus(incomingQueue);

  // Drag-and-Drop support for reordering the queue
  const sensors = useDndSensors();
  const dndId = useId();

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {
        active, // dragged item
        over, // on which item it was dropped
      } = event;

      // The item was dropped either nowhere, or on the same item
      if (over == null || active.id === over.id) {
        return;
      }

      const activeIndex = queue.findIndex((track) => track.id === active.id);
      const overIndex = queue.findIndex((track) => track.id === over.id);

      const newQueue = [...queue];

      const movedTrack = newQueue.splice(activeIndex, 1)[0]; // Remove active track
      newQueue.splice(overIndex, 0, movedTrack); // Move it to where the user dropped it

      player.setQueue(newQueue);
    },
    [queue],
  );

  const clearQueue = useCallback(async () => {
    const confirmed = await ask(
      t`This will remove all upcoming tracks. The current track will stay.`,
      {
        title: t`Clear queue?`,
        kind: 'warning',
        cancelLabel: t`Cancel`,
        okLabel: t`Clear`,
      },
    );

    if (confirmed) player.clearQueue();
  }, [t]);

  return (
    <DndContext
      onDragEnd={onDragEnd}
      id={dndId}
      modifiers={DND_MODIFIERS}
      sensors={sensors}
    >
      <div {...stylex.props(styles.queueHeader)}>
        <div {...stylex.props(styles.queueHeaderTitle)}>
          <span>{t`Upcoming tracks`}</span>
          <span {...stylex.props(styles.queueHeaderInfos)}>
            <TrackListStatus {...status} />
          </span>
        </div>
      </div>
      <ul {...stylex.props(styles.queueContent)}>
        <SortableContext
          items={shownQueue}
          strategy={verticalListSortingStrategy}
        >
          {shownQueue.map((track, index) => (
            <QueueListItem
              key={`track-${track.id}-${index}`}
              index={index}
              track={track}
              queueCursor={props.queueCursor}
            />
          ))}
        </SortableContext>
        {hiddenQueue.length > 0 && (
          <Button
            block
            onClick={() =>
              setQueueSize(
                Math.min(queueSize + INITIAL_QUEUE_SIZE, incomingQueue.length),
              )
            }
          >
            {t`see more`}
          </Button>
        )}
      </ul>
      <footer
        aria-label={t`Queue actions`}
        {...stylex.props(styles.queueActions)}
      >
        <ButtonIcon
          icon="trash"
          iconSize={16}
          label={t`Clear queue`}
          onClick={clearQueue}
          xstyle={styles.clearQueue}
        />
      </footer>
    </DndContext>
  );
}

const styles = stylex.create({
  queueHeader: {
    paddingBlock: '8px',
    paddingInline: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '8px',
    backgroundColor: 'var(--surface-raised)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  queueHeaderTitle: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  queueHeaderInfos: {
    color: 'var(--text-secondary)',
    fontSize: '11px',
  },
  queueContent: {
    minHeight: 0,
    flexGrow: 1,
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  queueActions: {
    flexShrink: 0,
    paddingBlock: '10px',
    paddingInline: '16px',
    display: 'flex',
    justifyContent: 'flex-end',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border-subtle)',
    backgroundColor: 'var(--surface-raised)',
  },
  clearQueue: {
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--danger-color)',
    },
  },
});
