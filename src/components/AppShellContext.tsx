import { createContext, useContext } from 'react';

export type NavigationMode = 'side' | 'top';

export type AppShellContextValue = {
  queueOpen: boolean;
  shouldFocusQueue: boolean;
  nowPlayingOpen: boolean;
  navigationMode: NavigationMode;
  sidebarCollapsed: boolean;
  toggleNavigationMode: () => void;
  toggleSidebar: () => void;
  registerQueueTrigger: (trigger: HTMLElement | null) => void;
  getMainContentElement: () => HTMLElement | null;
  scrollMainContentToTop: () => void;
  openQueue: (trigger: HTMLElement | null) => void;
  closeQueue: () => void;
  toggleQueue: (trigger: HTMLElement | null) => void;
  openNowPlaying: (trigger: HTMLElement | null) => void;
  closeNowPlaying: () => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const value = useContext(AppShellContext);

  if (value === null) {
    throw new Error('useAppShell must be used inside AppShell');
  }

  return value;
}
