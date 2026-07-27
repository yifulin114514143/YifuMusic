import { convertFileSrc } from '@tauri-apps/api/core';

import CoverBridge from './bridge-cover';

export async function getCover(path: string): Promise<string | null> {
  const cover = await CoverBridge.get(path);

  if (cover === null) {
    return null;
  }

  return cover.startsWith('data:') ? cover : convertFileSrc(cover);
}
