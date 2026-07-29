import * as stylex from '@stylexjs/stylex';
import type React from 'react';

import Icon, { type IconName, type IconSize } from '../components/Icon';

type Props = React.ComponentPropsWithRef<'button'> & {
  label: string;
  icon: IconName;
  iconSize?: IconSize;
  isActive?: boolean;
  xstyle?: stylex.CompiledStyles;
};

export default function ButtonIcon(props: Props) {
  const { label, onClick, icon, iconSize, isActive, ref, xstyle, ...rest } =
    props;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-museeks-action
      {...rest}
      {...stylex.props(styles.button, xstyle)}
    >
      <Icon
        name={icon}
        size={iconSize}
        color={isActive ? 'var(--main-color)' : undefined}
        {...stylex.props(styles.icon)}
      />
    </button>
  );
}

const styles = stylex.create({
  button: {
    minWidth: '32px',
    minHeight: '32px',
    padding: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
      ':active': 'var(--surface-selected)',
    },
    borderStyle: 'none',
    borderWidth: '0',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    textAlign: 'center',
    lineHeight: 1,
    cursor: 'pointer',
    opacity: {
      ':disabled': 0.45,
    },
  },
  icon: {
    verticalAlign: 'middle',
    pointerEvents: 'none',
  },
});
