import { invoke } from '@tauri-apps/api/core';

/**
 * Cover bridge for the UI to communicate with the backend.
 */
const CoverBridge = {
  async get(path: string): Promise<string | null> {
    return invoke('plugin:cover|get_cover', { path });
  },
};

export default CoverBridge;
