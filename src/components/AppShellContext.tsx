import { createContext, useContext } from 'react';

export type AppShellContextValue = {
  queueOpen: boolean;
  shouldFocusQueue: boolean;
  registerQueueTrigger: (trigger: HTMLElement | null) => void;
  openQueue: (trigger: HTMLElement | null) => void;
  closeQueue: () => void;
  toggleQueue: (trigger: HTMLElement | null) => void;
};

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const value = useContext(AppShellContext);

  if (value === null) {
    throw new Error('useAppShell must be used inside AppShell');
  }

  return value;
}
