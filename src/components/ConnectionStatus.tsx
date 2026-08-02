import * as stylex from '@stylexjs/stylex';
import { useEffect, useState } from 'react';

import type { NavigationMode } from './AppShellContext';

type Props = {
  isOnline: boolean;
  navigationMode: NavigationMode;
  sidebarCollapsed: boolean;
};

export function useConnectionStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return isOnline;
}

export default function ConnectionStatus(props: Props) {
  const { isOnline, navigationMode, sidebarCollapsed } = props;

  if (isOnline) return null;

  return (
    <div
      aria-live="polite"
      data-navigation-mode={navigationMode}
      data-reference-layout="moekoe-network-status"
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-testid="connection-status"
      role="status"
      {...stylex.props(
        styles.notice,
        navigationMode === 'side' ? styles.noticeSide : styles.noticeTop,
        navigationMode === 'side' &&
          sidebarCollapsed &&
          styles.noticeSideCollapsed,
      )}
    >
      <span aria-hidden="true" {...stylex.props(styles.icon)}>
        !
      </span>
      <span {...stylex.props(styles.copy)}>
        <strong>网络连接已断开</strong>
        <span>本地音乐仍可使用；在线功能将在服务接入后可用。</span>
      </span>
    </div>
  );
}

const styles = stylex.create({
  notice: {
    minWidth: 0,
    minHeight: '32px',
    boxSizing: 'border-box',
    position: 'fixed',
    right: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    columnGap: '8px',
    paddingBlock: '6px',
    paddingInline: '20px',
    color: '#ffffff',
    backgroundColor: 'var(--warning-color)',
    boxShadow: '0 3px 9px rgba(0, 0, 0, 0.14)',
    fontSize: '12px',
    lineHeight: 1.35,
  },
  noticeTop: {
    top: '64px',
    left: 0,
  },
  noticeSide: {
    top: '52px',
    left: '226px',
  },
  noticeSideCollapsed: {
    left: {
      default: '67px',
      '@media (max-width: 767px)': '64px',
    },
  },
  icon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: 800,
  },
  copy: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: '8px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
});
