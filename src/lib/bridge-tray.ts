import { invoke } from '@tauri-apps/api/core';

import type { TrayPayload } from './tray';

const TrayBridge = {
  syncState(payload: TrayPayload): Promise<void> {
    return invoke('plugin:tray|sync_state', { payload });
  },
};

export default TrayBridge;
