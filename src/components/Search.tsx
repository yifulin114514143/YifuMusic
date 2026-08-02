import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import Keybinding from 'react-keybinding-component';

import LibraryAPI from '../api/LibraryAPI';
import useLibraryStore from '../lib/store';
import { isCtrlKey } from '../lib/utils-events';
import Icon from './Icon';

type Props = {
  compact?: boolean;
};

export default function Search({ compact = false }: Props) {
  const search = useLibraryStore((state) => state.search);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLingui();
  const [isFocused, setIsFocused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isCompactOpen, setIsCompactOpen] = useState(false);
  const isCompactExpanded =
    compact && (isCompactOpen || isFocused || isHovering);

  const onClear = useCallback(() => {
    LibraryAPI.search('');

    if (location.pathname === '/search') {
      void navigate({
        to: '/search',
        search: {},
        replace: true,
      });
    }
  }, [location.pathname, navigate]);
  const onChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (event) => {
      const value = event.currentTarget.value;
      LibraryAPI.search(value);

      if (location.pathname === '/search') {
        void navigate({
          to: '/search',
          search: (previous) => ({
            ...previous,
            q: value.trim() || undefined,
          }),
          replace: true,
        });
      }
    },
    [location.pathname, navigate],
  );

  const onFocus = useCallback<React.FocusEventHandler<HTMLInputElement>>(
    (event) => {
      setIsFocused(true);
      setIsCompactOpen(true);
      event.currentTarget.select();
    },
    [],
  );

  const onBlur = useCallback<React.FocusEventHandler<HTMLInputElement>>(() => {
    setIsFocused(false);
  }, []);

  const focusCompactSearch = useCallback(() => {
    setIsCompactOpen(true);
    setIsFocused(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const onSubmit = useCallback(() => {
    const query = search.trim();

    if (query.length === 0) return;

    void navigate({
      to: '/search',
      search: { q: query },
    });
  }, [navigate, search]);

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit();
        return;
      }

      if (event.key === 'Escape' && search.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      }
    },
    [onClear, onSubmit, search.length],
  );

  // ctrl/cmf+f shortcut
  const onKey = (e: KeyboardEvent) => {
    if (isCtrlKey(e) && e.key.toLowerCase() === 'f') {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  };

  return (
    <div
      data-reference-layout={
        compact ? 'moekoe-top-search' : 'moekoe-sidebar-search'
      }
      data-expanded={compact ? isCompactExpanded : undefined}
      onMouseEnter={compact ? () => setIsHovering(true) : undefined}
      onMouseLeave={compact ? () => setIsHovering(false) : undefined}
      onBlurCapture={
        compact
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsCompactOpen(false);
              }
            }
          : undefined
      }
      {...stylex.props(
        styles.container,
        compact && styles.containerCompact,
        !compact && isFocused && styles.containerFocused,
        compact &&
          (isCompactExpanded
            ? styles.containerCompactExpanded
            : styles.containerCompactCollapsed),
      )}
    >
      {compact && (
        <button
          aria-label="打开搜索"
          aria-expanded={isCompactExpanded}
          title="打开搜索"
          type="button"
          onClick={focusCompactSearch}
          data-museeks-action
          {...stylex.props(styles.compactTrigger)}
        >
          <Icon name="search" size={12} />
        </button>
      )}
      <input
        type="text"
        placeholder={t`search...`}
        value={search}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onMouseUp={(e) => e.preventDefault()}
        spellCheck={false}
        ref={inputRef}
        aria-label={t`Search library`}
        {...stylex.props(
          styles.input,
          compact && styles.inputCompact,
          compact &&
            (isCompactExpanded
              ? styles.inputCompactExpanded
              : styles.inputCompactCollapsed),
          search.length > 0 && styles.inputNotEmpty,
        )}
      />
      {(!compact || isCompactExpanded) && search.length > 0 && (
        <button
          type="button"
          {...stylex.props(styles.clear)}
          onClick={onClear}
          data-museeks-action
          aria-label={t`Clear search`}
          title={t`Clear search`}
        >
          &times;
        </button>
      )}
      {(!compact || isCompactExpanded) && search.trim().length > 0 && (
        <button
          type="button"
          {...stylex.props(styles.submit)}
          onClick={onSubmit}
          data-museeks-action
          aria-label="查看完整搜索结果"
          title="查看完整搜索结果"
        >
          <Icon name="search" size={16} />
        </button>
      )}
      <Keybinding preventInputConflict onKey={onKey} />
    </div>
  );
}

const styles = stylex.create({
  container: {
    position: 'relative',
    width: {
      default: '200px',
      '@media (max-width: 767px)': '154px',
    },
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    transition: 'width 180ms ease-out',
  },
  containerFocused: {
    width: {
      default: '250px',
      '@media (max-width: 767px)': 'min(220px, 42vw)',
    },
  },
  containerCompact: {
    height: '26px',
    overflow: 'hidden',
    borderRadius: '999px',
    transition:
      'flex-basis 200ms ease-out, width 200ms ease-out, padding 200ms ease-out, column-gap 200ms ease-out, border-color 200ms ease-out',
  },
  containerCompactCollapsed: {
    rowGap: 0,
    columnGap: 0,
    padding: 0,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  containerCompactExpanded: {
    rowGap: 0,
    paddingInline: '8px',
    columnGap: '6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    backgroundColor: 'transparent',
  },
  input: {
    display: 'block',
    fontSize: 'inherit',
    width: '100%',
    minHeight: '36px',
    paddingBlock: '7px',
    paddingInline: '16px',
    backgroundColor: 'var(--search-bg)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-strong)',
    color: 'var(--text)',
    borderRadius: '999px',
    lineHeight: '16px',
  },
  inputCompact: {
    minHeight: '26px',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontSize: '12px',
    transition: 'width 200ms ease-out, opacity 150ms ease-out',
  },
  inputCompactCollapsed: {
    minWidth: 0,
  },
  inputCompactExpanded: {
    minWidth: 0,
  },
  inputNotEmpty: {
    borderColor: 'var(--accent)',
  },
  clear: {
    position: 'absolute',
    right: '30px',
    zIndex: 10, // to be above the input, even when focused
    fontSize: '15px',
    color: 'var(--text)',
    cursor: 'pointer',
    borderStyle: 'none',
    backgroundColor: 'transparent',
    padding: 0,
    minWidth: '32px',
    minHeight: '32px',
    aspectRatio: '1 / 1',
    lineHeight: '100%',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  submit: {
    position: 'absolute',
    right: '4px',
    zIndex: 10,
    minWidth: '28px',
    minHeight: '28px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    borderRadius: '999px',
    cursor: 'pointer',
  },
  compactTrigger: {
    width: '16px',
    height: '24px',
    flexShrink: 0,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
  },
});
