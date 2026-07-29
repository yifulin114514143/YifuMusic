import { NavigationMenu } from '@base-ui/react/navigation-menu';
import * as stylex from '@stylexjs/stylex';
import { groupBy } from 'lodash-es';
import React, { useMemo } from 'react';

import Flexbox from '../elements/Flexbox';
import { stripAccents } from '../lib/utils-library';
import type { SideNavLinkProps } from './SideNavLink';

type Props = {
  children: Array<React.ReactElement<SideNavLinkProps>>;
  title: string;
  actions?: React.ReactNode;
  bottomContent?: React.ReactNode;
};

export default function SideNav(props: Props) {
  // Let's group the children by first character
  const groupedChildren = useMemo(() => {
    const groups = groupBy(props.children, (child) => {
      const stripped = stripAccents(child.props.label[0]).toUpperCase();
      const code = stripped.charCodeAt(0);

      // Group under # if the first character is not a letter
      return code >= 65 && code <= 90 ? stripped : '#';
    });

    return groups;
  }, [props.children]);

  return (
    <div {...stylex.props(styles.nav)} data-museeks-list>
      <Flexbox gap={8} align="center" xstyle={styles.header}>
        <h4 {...stylex.props(styles.title)}>{props.title}</h4>
        <div {...stylex.props(styles.actions)}>{props.actions}</div>
      </Flexbox>
      <NavigationMenu.Root orientation="vertical">
        <NavigationMenu.List {...stylex.props(styles.content)}>
          {Object.entries(groupedChildren).map(([letter, children]) => {
            return (
              <React.Fragment key={letter}>
                <div {...stylex.props(styles.letter)}>{letter}</div>
                <div {...stylex.props(styles.items)}>{children}</div>
              </React.Fragment>
            );
          })}
          {props.bottomContent && (
            <>
              {/** should probably be a prop */}
              <div {...stylex.props(styles.letter)}>///</div>
              {props.bottomContent}
            </>
          )}
        </NavigationMenu.List>
      </NavigationMenu.Root>
    </div>
  );
}

const styles = stylex.create({
  nav: {
    display: 'flex',
    flexFlow: 'column',
    flexShrink: 0,
    width: {
      default: '200px',
      '@media (max-width: 1399px)': '160px',
      '@media (max-width: 999px)': '176px',
      '@media (max-width: 699px)': '140px',
    },
    minWidth: {
      default: '160px',
      '@media (max-width: 1399px)': '140px',
      '@media (max-width: 999px)': '140px',
      '@media (max-width: 699px)': '120px',
    },
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-color)',
    backgroundColor: 'var(--surface-sunken)',
    maxHeight: '100%',
    overflow: 'hidden',
    position: 'relative',
    top: 0,
  },
  header: {
    zIndex: 10,
    position: 'sticky',
    top: 0,
    backgroundColor: 'var(--surface-sunken)',
  },
  actions: {
    alignItems: 'stretch',
    marginRight: '8px',
  },
  title: {
    marginBlock: '10px',
    marginInline: '12px',
    fontSize: '0.875rem',
    fontWeight: 'bold',
    color: 'var(--text-muted)',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  letter: {
    display: 'block',
    paddingBlock: '8px',
    paddingInline: '12px',
    textTransform: 'uppercase',
    fontWeight: 'bolder',
    position: 'sticky',
    top: '32px',
    backgroundColor: 'var(--surface-sunken)',
    color: 'var(--text-muted)',
  },
  items: {
    display: 'block',
    marginBottom: '12px',
  },
});
