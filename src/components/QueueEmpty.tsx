import { Trans } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';

export default function QueueEmpty() {
  return (
    <div {...stylex.props(styles.queueEmpty)}>
      <strong>
        <Trans>Queue is empty</Trans>
      </strong>
      <span>
        <Trans>Play a track from your library to get started</Trans>
      </span>
    </div>
  );
}

const styles = stylex.create({
  queueEmpty: {
    minHeight: 0,
    flexGrow: 1,
    padding: '24px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: '6px',
  },
});
