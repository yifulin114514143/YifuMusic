import { DndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import type { Track } from '../generated/typings';
import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config';
import { messages } from '../translations/zh-CN.po';

const TRACK: Track = {
  id: 'queue-drag-handle-test',
  path: '/queue-drag-handle-test.mp3',
  title: '队列候选曲目',
  album: '测试专辑',
  album_artist: '测试艺人',
  artists: ['测试艺人'],
  genres: [],
  year: null,
  duration: 180,
  track_no: 1,
  track_of: 1,
  disk_no: 1,
  disk_of: 1,
  is_compilation: false,
};

let QueueListItem: typeof import('./QueueListItem').default;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('__MUSEEKS_INITIAL_CONFIG', MOCK_CONFIG);
  vi.stubGlobal('__MUSEEKS_STREAM_SERVER_URL', null);
  vi.stubGlobal('__TAURI_INTERNALS__', {
    invoke: vi
      .fn<(...args: unknown[]) => Promise<null>>()
      .mockResolvedValue(null),
  });
  vi.doMock('../lib/bridge-config');

  ({ default: QueueListItem } = await import('./QueueListItem'));
  i18n.load('zh-CN', messages);
  i18n.activate('zh-CN');
});

afterEach(async () => {
  await cleanup();
  vi.doUnmock('../lib/bridge-config');
  vi.resetModules();
  vi.unstubAllGlobals();
});

test('provides a localized, independent queue drag handle', async () => {
  await render(
    <I18nProvider i18n={i18n}>
      <DndContext>
        <SortableContext
          items={[TRACK.id]}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            <QueueListItem index={0} queueCursor={0} track={TRACK} />
          </ul>
        </SortableContext>
      </DndContext>
    </I18nProvider>,
  );

  const label = `重新排序 ${TRACK.title}`;
  const handle = page.getByRole('button', { name: label });
  const item = handle.element().closest('li');

  await expect.element(handle).toHaveAttribute('aria-label', label);
  await expect.element(handle).toHaveAttribute('title', label);
  await expect.element(handle).toHaveAttribute('aria-describedby');
  expect(item?.getAttribute('aria-describedby')).toBeNull();
});
