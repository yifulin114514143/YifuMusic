import * as stylex from '@stylexjs/stylex';
import type React from 'react';

type Props = {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
};

/**
 * Route-level detail heading shared by local library views.
 */
export default function ContentHeader(props: Props) {
  const { title, description, meta, actions } = props;

  return (
    <header {...stylex.props(styles.header)}>
      <div {...stylex.props(styles.copy)}>
        <h2 {...stylex.props(styles.title)}>{title}</h2>
        {description != null && (
          <p {...stylex.props(styles.description)}>{description}</p>
        )}
        {meta != null && <div {...stylex.props(styles.meta)}>{meta}</div>}
      </div>
      {actions != null && (
        <div {...stylex.props(styles.actions)}>{actions}</div>
      )}
    </header>
  );
}

const styles = stylex.create({
  header: {
    minWidth: 0,
    paddingBlock: '16px',
    paddingInline: {
      default: '24px',
      '@media (max-width: 899px)': '16px',
    },
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: '16px',
    rowGap: '12px',
    flexWrap: 'wrap',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
    backgroundColor: 'var(--surface-canvas)',
  },
  copy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
  },
  title: {
    minWidth: 0,
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '20px',
    fontWeight: 700,
    lineHeight: 1.25,
    overflowWrap: 'anywhere',
  },
  description: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.4,
  },
  meta: {
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.4,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
});
