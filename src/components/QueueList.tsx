import {
  closestCenter,
  DndContext,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { ask } from '@tauri-apps/plugin-dialog';
import { useCallback, useId, useRef, useState } from 'react';

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
  const isKeyboardDrag = useRef(false);
  const lastPointerOverQueueIndex = useRef<number | null>(null);

  const onDragStart = useCallback((event: DragStartEvent) => {
    isKeyboardDrag.current = event.activatorEvent instanceof KeyboardEvent;
    lastPointerOverQueueIndex.current = null;
  }, []);

  const onDragOver = useCallback((event: DragOverEvent) => {
    if (isKeyboardDrag.current || event.over?.id === event.active.id) return;

    const overQueueIndex = event.over?.data.current?.queueIndex;
    if (typeof overQueueIndex === 'number') {
      lastPointerOverQueueIndex.current = overQueueIndex;
    }
  }, []);

  const collisionDetection = useCallback<CollisionDetection>((args) => {
    if (isKeyboardDrag.current) return closestCenter(args);

    const pointerArgs = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.id !== args.active.id,
      ),
    };
    const pointerCollisions = pointerWithin(pointerArgs);
    return pointerCollisions.length > 0
      ? pointerCollisions
      : closestCenter(pointerArgs);
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const {
        active, // dragged item
        over, // on which item it was dropped
      } = event;
      isKeyboardDrag.current = false;

      const activeIndex = active.data.current?.queueIndex;
      const overIndex =
        over?.id === active.id || over == null
          ? lastPointerOverQueueIndex.current
          : over.data.current?.queueIndex;
      lastPointerOverQueueIndex.current = null;

      if (typeof activeIndex !== 'number' || typeof overIndex !== 'number') {
        return;
      }

      player.setQueue(arrayMove(queue, activeIndex, overIndex));
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
      collisionDetection={collisionDetection}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        isKeyboardDrag.current = false;
        lastPointerOverQueueIndex.current = null;
      }}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
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
          items={shownQueue.map((_track, index) => queueCursor + index + 1)}
          strategy={verticalListSortingStrategy}
        >
          {shownQueue.map((track, index) => (
            <QueueListItem
              key={`track-${track.id}-${index}`}
              index={index}
              queueIndex={queueCursor + index + 1}
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
