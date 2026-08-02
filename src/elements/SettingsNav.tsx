import { NavigationMenu } from '@base-ui/react/navigation-menu';
import * as stylex from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import type React from 'react';

interface WrapProps {
  children: React.ReactNode;
}

/**
 * Wrapper for navigation
 */
export function SettingsNav(props: WrapProps) {
  return (
    <NavigationMenu.Root orientation="vertical">
      <NavigationMenu.List {...stylex.props(styles.nav)}>
        {props.children}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

interface LinkProps {
  children: React.ReactNode;
  to: string;
}

/**
 * Single navigation item (anchor)
 */
export function SettingsNavLink(props: LinkProps) {
  return (
    <NavigationMenu.Item>
      <NavigationMenu.Link
        render={(renderProps) => (
          <Link
            to={props.to}
            draggable={false}
            {...renderProps}
            {...stylex.props(styles.link)}
          >
            {props.children}
          </Link>
        )}
      />
    </NavigationMenu.Item>
  );
}

const styles = stylex.create({
  nav: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    columnGap: '4px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  link: {
    minHeight: '36px',
    paddingBlock: '8px',
    paddingInline: '10px',
    display: 'flex',
    alignItems: 'center',
    fontWeight: 600,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    textDecorationLine: 'none',
    color: {
      default: 'var(--text-secondary)',
      ':hover': 'var(--text-primary)',
      ':is([data-status="active"])': 'var(--text-primary)',
    },
    backgroundColor: {
      ':hover': 'var(--surface-hover)',
      ':is([data-status="active"])': 'var(--surface-selected)',
    },
    borderRadius: 'var(--radius-sm)',
    boxShadow: {
      default: 'inset 3px 0 0 transparent',
      ':is([data-status="active"])': 'inset 3px 0 0 var(--accent)',
    },
  },
});
