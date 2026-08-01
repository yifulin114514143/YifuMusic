import { vi } from 'vite-plus/test';

import type { TrayPayload } from '../tray';

const TrayBridge = {
  syncState: vi
    .fn<(payload: TrayPayload) => Promise<void>>()
    .mockResolvedValue(),
};

export default TrayBridge;
