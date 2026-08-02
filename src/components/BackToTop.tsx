import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';

import { useAppShell } from './AppShellContext';
import Icon from './Icon';

type Props = {
  threshold?: number;
};

/**
 * Mirrors the reference-page utility while using the app shell's actual
 * scroll container instead of the browser document.
 */
export default function BackToTop({ threshold = 240 }: Props) {
  const { getMainContentElement, scrollMainContentToTop } = useAppShell();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mainContent = getMainContentElement();
    if (mainContent === null) return;

    const updateVisibility = () => {
      setIsVisible(mainContent.scrollTop >= threshold);
    };

    updateVisibility();
    mainContent.addEventListener('scroll', updateVisibility, { passive: true });

    return () => {
      mainContent.removeEventListener('scroll', updateVisibility);
    };
  }, [getMainContentElement, threshold]);

  if (!isVisible) return null;

  return (
    <button
      aria-label="回到顶部"
      data-testid="back-to-top"
      title="回到顶部"
      type="button"
      onClick={scrollMainContentToTop}
      {...stylex.props(styles.button)}
    >
      <Icon name="arrowUp" size={16} />
    </button>
  );
}

const styles = stylex.create({
  button: {
    width: '40px',
    height: '40px',
    position: 'fixed',
    zIndex: 8,
    right: {
      default: '24px',
      '@media (max-width: 767px)': '14px',
    },
    bottom: {
      default: '104px',
      '@media (max-width: 767px)': '94px',
    },
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--accent-border)',
    borderRadius: '50%',
    backgroundColor: {
      default: 'var(--surface-raised)',
      ':hover': 'var(--accent-subtle)',
    },
    boxShadow: '0 8px 18px rgba(31, 41, 55, 0.14)',
    cursor: 'pointer',
    outline: {
      ':focus-visible': '2px solid var(--focus-color)',
    },
    transition: {
      default: 'transform 160ms ease, background-color 160ms ease',
      '@media (prefers-reduced-motion: reduce)': 'none',
    },
    transform: {
      ':hover': 'translateY(-2px)',
    },
  },
});
