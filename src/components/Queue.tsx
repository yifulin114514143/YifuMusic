import * as stylex from '@stylexjs/stylex';
import { useMemo } from 'react';

import type { Track } from '../generated/typings';
import QueueEmpty from './QueueEmpty';
import QueueList from './QueueList';

type Props = {
  queue: Track[];
  queueCursor: number | null;
};

export default function Queue(props: Props) {
  const { queue, queueCursor } = props;
  const isQueueEmpty = useMemo(() => {
    if (queueCursor == null) {
      return null;
    }

    return queue.slice(queueCursor + 1).length === 0;
  }, [queue, queueCursor]);

  return (
    <div {...stylex.props(styles.queue)}>
      {isQueueEmpty || queueCursor == null ? (
        <QueueEmpty />
      ) : (
        <QueueList queue={queue} queueCursor={queueCursor} />
      )}
    </div>
  );
}

const styles = stylex.create({
  queue: {
    minHeight: 0,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--surface-raised)',
    fontSize: '12px',
    textAlign: 'left',
  },
});
