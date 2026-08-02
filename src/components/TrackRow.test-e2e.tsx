import { DndContext } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import type { Track } from '../generated/typings';
import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config';
import { messages } from '../translations/zh-CN.po';

const TRACK: Track = {
  id: 'playlist-drag-keyboard-test',
  path: '/playlist-drag-keyboard-test.mp3',
  title: '歌单排序测试曲目',
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

let TrackRow: typeof import('./TrackRow').default;

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

  ({ default: TrackRow } = await import('./TrackRow'));
  i18n.load('zh-CN', messages);
  i18n.activate('zh-CN');
});

afterEach(async () => {
  await cleanup();
  vi.doUnmock('../lib/bridge-config');
  vi.resetModules();
  vi.unstubAllGlobals();
});

test('marks playlist keyboard reordering as handled before global player shortcuts', async () => {
  const onDocumentKeyDown = vi.fn<(event: KeyboardEvent) => void>();
  document.addEventListener('keydown', onDocumentKeyDown);

  try {
    await render(
      <I18nProvider i18n={i18n}>
        <DndContext>
          <SortableContext
            items={[TRACK.id]}
            strategy={verticalListSortingStrategy}
          >
            <ul>
              <TrackRow
                draggable
                index={0}
                selected={false}
                track={TRACK}
                onContextMenu={() => {}}
                onMoreActions={() => {}}
                onPlaybackStart={() => {}}
                onTrackSelect={() => {}}
              />
            </ul>
          </SortableContext>
        </DndContext>
      </I18nProvider>,
    );

    const row = page.getByRole('option', { name: TRACK.title });
    row.element().focus();
    await userEvent.keyboard('{Space}');

    expect(onDocumentKeyDown).toHaveBeenCalledTimes(1);
    expect(onDocumentKeyDown.mock.calls[0][0].defaultPrevented).toBe(true);
  } finally {
    document.removeEventListener('keydown', onDocumentKeyDown);
  }
});
