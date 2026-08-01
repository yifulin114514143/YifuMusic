import * as stylex from '@stylexjs/stylex';
import type React from 'react';
import { useId } from 'react';

type Props = {
  children: React.ReactNode;
};

export function Section(props: Props) {
  return (
    <section
      data-reference-layout="moekoe-setting-card"
      data-testid="setting-card"
      {...stylex.props(styles.settingSection)}
    >
      {props.children}
    </section>
  );
}

export function Description(props: Props) {
  return <p {...stylex.props(styles.settingDescription)}>{props.children}</p>;
}

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
};

/**
 * The title band shown above the cards of one settings category.
 *
 * MoeKoeMusic presents one active category at a time. Keeping this component
 * inside the setting primitive makes every child route share that hierarchy.
 */
export function PageHeader(props: PageHeaderProps) {
  return (
    <header {...stylex.props(styles.pageHeader)}>
      <h2 {...stylex.props(styles.pageTitle)}>{props.title}</h2>
      {props.description != null && (
        <p {...stylex.props(styles.pageDescription)}>{props.description}</p>
      )}
    </header>
  );
}

export function Label(
  props: React.LabelHTMLAttributes<HTMLLabelElement> & {
    noMargin?: boolean;
    htmlFor: string;
  },
) {
  const { children, noMargin, htmlFor, ...restProps } = props;

  return (
    <label
      htmlFor={htmlFor}
      {...restProps}
      {...stylex.props(
        styles.settingLabel,
        noMargin && styles.settingLabelNoMargin,
      )}
    >
      {children}
    </label>
  );
}

export function Title(props: Props) {
  return <h3 {...stylex.props(styles.settingTitle)}>{props.children}</h3>;
}

type InputProps = {
  label: string;
  description?: string | React.ReactNode;
};

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & InputProps,
) {
  const { label, description, ...otherProps } = props;
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        autoComplete="off"
        {...otherProps}
        {...stylex.props(styles.settingInput)}
      />
      {description != null && <Description>{description}</Description>}
    </div>
  );
}

export function Select(
  props: Props & React.SelectHTMLAttributes<HTMLSelectElement> & InputProps,
) {
  const { label, description, ...otherProps } = props;
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} {...otherProps} {...stylex.props(styles.settingSelect)}>
        {props.children}
      </select>
      {description != null && <Description>{description}</Description>}
    </div>
  );
}

export function ColorSelector(
  props: React.InputHTMLAttributes<HTMLInputElement> & InputProps,
) {
  const { label, description, ...otherProps } = props;
  const id = useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="color"
        {...otherProps}
        {...stylex.props(styles.settingInput, styles.settingColorInput)}
      />
      {description != null && <Description>{description}</Description>}
    </div>
  );
}

type ToggleProps = {
  title: string;
  description?: React.ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
};

/**
 * A native checkbox control visually presented and exposed as the compact
 * MoeKoeMusic setting switch. It keeps each existing config mutation and
 * keyboard behavior owned by the caller while supplying a Chinese on/off value.
 */
export function Toggle(props: ToggleProps) {
  const { title, description, value, onChange } = props;
  const id = useId();

  return (
    <div {...stylex.props(styles.toggleSetting)}>
      <Label htmlFor={id} noMargin>
        {title}
      </Label>
      {description != null && <Description>{description}</Description>}
      <div {...stylex.props(styles.toggleValue)}>
        <span aria-hidden="true" {...stylex.props(styles.toggleStatus)}>
          {value ? '已开启' : '已关闭'}
        </span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-label={title}
          aria-checked={value}
          checked={value}
          onChange={(event) => onChange(event.currentTarget.checked)}
          {...stylex.props(
            styles.toggleInput,
            value && styles.toggleInputChecked,
          )}
        />
      </div>
    </div>
  );
}

const styles = stylex.create({
  settingSection: {
    minWidth: 0,
    boxSizing: 'border-box',
    marginBottom: 0,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
    columnGap: '10px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'var(--border-subtle)',
      ':focus-within': 'var(--accent-border)',
    },
    borderRadius: '12px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: {
      default: '0 8px 22px rgba(30, 55, 78, 0.04)',
      ':hover': '0 12px 24px rgba(30, 55, 78, 0.1)',
      ':focus-within': '0 0 0 3px var(--accent-subtle)',
    },
    transition: 'transform 160ms ease, box-shadow 160ms ease',
    transform: {
      ':hover': 'translateY(-2px)',
    },
  },
  pageHeader: {
    gridColumnStart: '1',
    gridColumnEnd: '-1',
    minWidth: 0,
    paddingBottom: '10px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  pageTitle: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '22px',
    fontWeight: 600,
    lineHeight: 1.25,
  },
  pageDescription: {
    marginTop: '7px',
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: 1.55,
  },
  settingTitle: {
    display: 'block',
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '16px',
    lineHeight: 1.4,
  },
  settingDescription: {
    fontWeight: 'normal',
    marginTop: 0,
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  settingLabel: {
    display: 'inline-block',
    marginBottom: '2px',
    color: 'var(--text-primary)',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  settingLabelNoMargin: {
    marginBottom: 0,
  },
  toggleSetting: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '7px',
    columnGap: '7px',
    minWidth: 0,
  },
  toggleValue: {
    minHeight: '38px',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    rowGap: '12px',
    columnGap: '12px',
    paddingBlock: '4px',
    paddingInline: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '6px',
    backgroundColor: 'var(--surface-sunken)',
  },
  toggleStatus: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  toggleInput: {
    position: 'relative',
    flexShrink: 0,
    appearance: 'none',
    width: '40px',
    height: '22px',
    margin: 0,
    padding: 0,
    borderWidth: 0,
    borderRadius: '999px',
    backgroundColor: 'var(--border-strong)',
    cursor: 'pointer',
    transition: 'background-color 160ms ease',
    '::after': {
      content: '""',
      position: 'absolute',
      top: '3px',
      left: '3px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
      transition: 'transform 160ms ease',
    },
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
  },
  toggleInputChecked: {
    backgroundColor: 'var(--main-color)',
    '::after': {
      transform: 'translateX(18px)',
    },
  },
  settingSelect: {
    appearance: 'none',
    display: 'block',
    backgroundColor: 'var(--surface-sunken)',
    color: 'var(--input-color)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'var(--border-color-softer)',
      ':focus': 'var(--main-color)',
    },
    borderRadius: 'var(--border-radius)',
    paddingBlock: '8px',
    paddingInline: '10px',
    width: '100%',
    minHeight: '38px',
    boxSizing: 'border-box',
    fontSize: '14px',
    opacity: {
      ':disabled': 0.6,
    },
    cursor: {
      ':disabled': 'not-allowed',
    },
  },
  settingInput: {
    appearance: 'none',
    display: 'block',
    backgroundColor: 'var(--surface-sunken)',
    color: 'var(--input-color)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: {
      default: 'var(--border-color-softer)',
      ':focus': 'var(--main-color)',
    },
    borderRadius: 'var(--border-radius)',
    paddingBlock: '8px',
    paddingInline: '10px',
    width: '100%',
    minHeight: '38px',
    boxSizing: 'border-box',
    fontSize: '14px',
    opacity: {
      ':disabled': 0.6,
    },
    cursor: {
      ':disabled': 'not-allowed',
    },
  },
  settingColorInput: {
    padding: '3px',
    width: '100%',
  },
});
