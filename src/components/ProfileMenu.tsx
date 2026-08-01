import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import Icon from './Icon';

type Props = {
  compact?: boolean;
  variant: 'header' | 'sidebar';
};

type UnavailableServiceProps = {
  label: string;
};

function UnavailableService({ label }: UnavailableServiceProps) {
  return (
    <button
      aria-disabled="true"
      aria-label={label}
      disabled
      role="menuitem"
      title={label}
      type="button"
      {...stylex.props(styles.menuItem, styles.menuItemUnavailable)}
    >
      <span>{label}</span>
      <small>服务接入后可用</small>
    </button>
  );
}

export default function ProfileMenu({ compact = false, variant }: Props) {
  const { t } = useLingui();
  const [menuOpen, setMenuOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeDisclaimerRef = useRef<HTMLButtonElement>(null);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const closeDisclaimer = () => {
    setDisclaimerOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu(true);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!disclaimerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDisclaimer();
    };

    window.requestAnimationFrame(() => closeDisclaimerRef.current?.focus());
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [disclaimerOpen]);

  const openDisclaimer = () => {
    setMenuOpen(false);
    setDisclaimerOpen(true);
  };

  return (
    <div
      ref={rootRef}
      data-profile-variant={variant}
      data-reference-layout="moekoe-profile"
      {...stylex.props(
        styles.root,
        variant === 'sidebar' ? styles.rootSidebar : styles.rootHeader,
        compact && styles.rootCompact,
      )}
    >
      <button
        ref={triggerRef}
        aria-controls="profile-service-menu"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={t`打开资料与服务菜单`}
        data-museeks-action
        title={t`打开资料与服务菜单`}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        {...stylex.props(
          styles.trigger,
          variant === 'sidebar' ? styles.triggerSidebar : styles.triggerHeader,
          compact && styles.triggerCompact,
        )}
      >
        <span aria-hidden="true" {...stylex.props(styles.mark)}>
          Y
        </span>
        {variant === 'sidebar' && !compact && (
          <span {...stylex.props(styles.triggerCopy)}>
            <strong>YifuMusic</strong>
            <small>本地音乐与服务说明</small>
          </span>
        )}
        {variant === 'sidebar' && !compact && (
          <Icon name="ellipsis" size={20} xstyle={styles.ellipsis} />
        )}
      </button>

      {menuOpen && (
        <div
          aria-label={t`资料与服务菜单`}
          id="profile-service-menu"
          role="menu"
          {...stylex.props(styles.menu)}
        >
          <div {...stylex.props(styles.menuHeading)}>
            <strong>YifuMusic 服务</strong>
            <span>本地功能可直接使用</span>
          </div>
          <UnavailableService label={t`登录（服务接入后可用）`} />
          <UnavailableService label={t`VIP（服务接入后可用）`} />
          <UnavailableService label={t`我的云盘（服务接入后可用）`} />
          <UnavailableService label={t`在线收藏（服务接入后可用）`} />
          <UnavailableService label={t`检查更新（服务接入后可用）`} />
          <Link
            aria-label={t`Settings`}
            role="menuitem"
            tabIndex={0}
            title={t`Settings`}
            to="/settings"
            draggable={false}
            data-museeks-action
            onClick={() => closeMenu()}
            {...stylex.props(styles.menuItem)}
          >
            <span>{t`Settings`}</span>
          </Link>
          <button
            aria-label={t`免责声明`}
            role="menuitem"
            title={t`免责声明`}
            type="button"
            onClick={openDisclaimer}
            {...stylex.props(styles.menuItem)}
          >
            <span>{t`免责声明`}</span>
          </button>
        </div>
      )}

      {disclaimerOpen && (
        <>
          <button
            aria-label={t`关闭免责声明`}
            type="button"
            onClick={closeDisclaimer}
            {...stylex.props(styles.backdrop)}
          />
          <section
            aria-describedby="yifu-disclaimer-description"
            aria-labelledby="yifu-disclaimer-title"
            aria-modal="true"
            data-reference-layout="moekoe-disclaimer"
            role="dialog"
            {...stylex.props(styles.dialog)}
          >
            <div {...stylex.props(styles.dialogHeader)}>
              <h2 id="yifu-disclaimer-title" {...stylex.props(styles.title)}>
                {t`免责声明`}
              </h2>
              <button
                ref={closeDisclaimerRef}
                aria-label={t`关闭免责声明`}
                data-museeks-action
                title={t`关闭免责声明`}
                type="button"
                onClick={closeDisclaimer}
                {...stylex.props(styles.closeButton)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div
              id="yifu-disclaimer-description"
              {...stylex.props(styles.dialogCopy)}
            >
              <p>
                YifuMusic
                当前提供本地音乐库、播放队列和本地歌词等功能；这些功能仅使用你已选择或已扫描的本地数据。
              </p>
              <p>
                登录、VIP、云盘、在线收藏、在线搜索、在线歌词和检查更新尚未接入服务，不会显示虚构的账号、容量、歌曲或更新结果。
              </p>
              <p>
                在相应服务具有可验证的接口与授权后，应用会单独提供接入说明与实际状态。
              </p>
            </div>
            <button
              type="button"
              onClick={closeDisclaimer}
              {...stylex.props(styles.confirmButton)}
            >
              {t`我知道了`}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

const styles = stylex.create({
  root: {
    position: 'relative',
    minWidth: 0,
  },
  rootSidebar: {
    flexGrow: 1,
  },
  rootHeader: {
    flexShrink: 0,
  },
  rootCompact: {
    flexGrow: 0,
  },
  trigger: {
    minWidth: 0,
    borderWidth: 0,
    borderStyle: 'none',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
  triggerSidebar: {
    width: '100%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    backgroundColor: 'transparent',
    textAlign: 'left',
  },
  triggerHeader: {
    width: '40px',
    height: '40px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    backgroundColor: {
      default: 'var(--accent)',
      ':hover': 'var(--main-color)',
      ':active': 'var(--surface-selected)',
    },
  },
  triggerCompact: {
    width: '40px',
    flexGrow: 0,
    justifyContent: 'center',
  },
  mark: {
    width: '38px',
    height: '38px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    backgroundImage:
      'linear-gradient(135deg, var(--main-color), color-mix(in srgb, var(--main-color) 58%, white))',
    borderRadius: '999px',
    boxShadow:
      '0 3px 10px color-mix(in srgb, var(--main-color) 25%, transparent)',
    fontSize: '14px',
    fontWeight: 750,
  },
  triggerCopy: {
    minWidth: 0,
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    overflow: 'hidden',
  },
  ellipsis: {
    flexShrink: 0,
    color: 'var(--text-secondary)',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    zIndex: 80,
    boxSizing: 'border-box',
    width: 'min(300px, calc(100vw - 28px))',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: 'var(--shadow-panel)',
  },
  menuHeading: {
    paddingBlock: '8px',
    paddingInline: '10px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
    color: 'var(--text-primary)',
    fontSize: '13px',
  },
  menuItem: {
    width: '100%',
    minHeight: '38px',
    boxSizing: 'border-box',
    paddingBlock: '7px',
    paddingInline: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '10px',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
      ':active': 'var(--surface-selected)',
    },
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: 1.35,
    textAlign: 'left',
    textDecorationLine: 'none',
  },
  menuItemUnavailable: {
    color: 'var(--text-secondary)',
    cursor: 'not-allowed',
    opacity: 0.62,
  },
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 89,
    borderWidth: 0,
    borderStyle: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    cursor: 'default',
  },
  dialog: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: 90,
    boxSizing: 'border-box',
    width: 'min(540px, calc(100vw - 32px))',
    maxHeight: 'min(620px, calc(100dvh - 128px))',
    padding: '20px',
    overflowY: 'auto',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '16px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--surface-raised)',
    boxShadow: 'var(--shadow-panel)',
    transform: 'translate(-50%, -50%)',
  },
  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: '12px',
  },
  title: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '22px',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    flexShrink: 0,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    backgroundColor: {
      default: 'transparent',
      ':hover': 'var(--surface-hover)',
      ':active': 'var(--surface-selected)',
    },
    cursor: 'pointer',
  },
  dialogCopy: {
    marginTop: '14px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '10px',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    lineHeight: 1.65,
  },
  confirmButton: {
    minHeight: '36px',
    marginTop: '18px',
    paddingInline: '16px',
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: '8px',
    color: 'var(--accent-contrast)',
    backgroundColor: 'var(--accent)',
    cursor: 'pointer',
    fontWeight: 700,
  },
});
