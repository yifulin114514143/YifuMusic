import * as stylex from '@stylexjs/stylex';

import type SideNav from '../components/SideNav';

type Props = {
  children: React.ReactNode;
  sideNav?: React.ReactElement<typeof SideNav>;
  layout?: keyof typeof layoutVariants;
  hasPadding?: boolean;
  xstyle?: stylex.CompiledStyles;
};

/**
 * Default View to be used by all route components
 */
export default function View(props: Props) {
  const { layout = 'full-width' } = props;

  // Playlists or Artists pages
  if (props.sideNav) {
    return (
      <div
        {...stylex.props(
          styles.view,
          styles.viewWithSideNav,
          layoutVariants[layout],
        )}
      >
        {props.sideNav}
        <div
          {...stylex.props(
            styles.viewContent,
            props.hasPadding && styles.hasPadding,
            props.xstyle,
          )}
        >
          {props.children}
        </div>
      </div>
    );
  }

  // Library or Settings pages
  return (
    <div
      {...stylex.props(
        styles.view,
        layoutVariants[layout],
        props.hasPadding && styles.hasPadding,
        props.xstyle,
      )}
    >
      {layout === 'centered' ? (
        <div {...stylex.props(styles.centeredContent)}>{props.children}</div>
      ) : (
        props.children
      )}
    </div>
  );
}

const styles = stylex.create({
  view: {
    minHeight: '100%',
    padding: {
      default: '20px',
      '@media (max-width: 699px)': '14px',
    },
    backgroundColor: 'var(--surface-canvas)',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    overflow: 'visible',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  centeredContent: {
    position: 'relative',
  },
  hasPadding: {
    padding: {
      default: '20px',
      '@media (max-width: 699px)': '14px',
    },
  },
  viewWithSideNav: {
    display: 'flex',
    padding: 0,
    overflow: 'visible',
  },
  viewContent: {
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: 0,
    padding: {
      default: '20px',
      '@media (max-width: 699px)': '14px',
    },
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
  },
});

const layoutVariants = stylex.create({
  'full-width': {},
  centered: {
    display: 'grid',
    gridTemplateColumns: {
      default: '350px',
      '@media (max-width: 599px)': 'minmax(0, 1fr)',
    },
    justifyContent: 'center',
    scrollbarGutter: 'stable',
    overflowY: 'visible',
  },
});
