import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { cdp, page, userEvent } from 'vite-plus/test/browser';
import type { CDPSession } from 'vite-plus/test/browser-playwright';
import { cleanup, render } from 'vitest-browser-react';

import type { Track } from '../generated/typings';
import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config';
import { messages } from '../translations/zh-CN.po';

const QUEUE: Track[] = ['正在播放', '第一首后续曲目', '第二首后续曲目'].map(
  (title, index) => ({
    id: `queue-keyboard-reorder-${index}`,
    path: `/queue-keyboard-reorder-${index}.mp3`,
    title,
    album: '队列测试专辑',
    album_artist: '队列测试艺人',
    artists: ['队列测试艺人'],
    genres: [],
    year: null,
    duration: 180,
    track_no: index + 1,
    track_of: 3,
    disk_no: 1,
    disk_of: 1,
    is_compilation: false,
  }),
);

let QueueList: typeof import('./QueueList').default;
let player: typeof import('../lib/player').default;

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

  ({ default: QueueList } = await import('./QueueList'));
  ({ default: player } = await import('../lib/player'));
  i18n.load('zh-CN', messages);
  i18n.activate('zh-CN');
});

afterEach(async () => {
  await cleanup();
  vi.doUnmock('../lib/bridge-config');
  vi.resetModules();
  vi.unstubAllGlobals();
});

test('reorders the upcoming queue through the keyboard drag workflow', async () => {
  const setQueue = vi.spyOn(player, 'setQueue').mockImplementation(() => {});

  try {
    await render(
      <I18nProvider i18n={i18n}>
        <QueueList queue={QUEUE} queueCursor={0} />
      </I18nProvider>,
    );

    const handle = page.getByRole('button', {
      name: `重新排序 ${QUEUE[1].title}`,
    });
    handle.element().focus();

    await userEvent.keyboard('{Space}');
    await new Promise<void>((resolve) => window.setTimeout(resolve));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Space}');

    expect(setQueue).toHaveBeenCalledTimes(1);
    expect(setQueue).toHaveBeenLastCalledWith([QUEUE[0], QUEUE[2], QUEUE[1]]);
  } finally {
    setQueue.mockRestore();
  }
});

test('reorders the upcoming queue through the pointer drag workflow', async () => {
  const setQueue = vi.spyOn(player, 'setQueue').mockImplementation(() => {});

  try {
    await render(
      <I18nProvider i18n={i18n}>
        <QueueList queue={QUEUE} queueCursor={0} />
      </I18nProvider>,
    );

    const source = page.getByRole('button', {
      name: `重新排序 ${QUEUE[1].title}`,
    });
    const destination = page.getByRole('button', {
      name: `重新排序 ${QUEUE[2].title}`,
    });

    const sourceRect = source.element().getBoundingClientRect();
    const destinationRect = destination.element().getBoundingClientRect();
    const mouse = cdp() as CDPSession;
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const destinationX = destinationRect.left + destinationRect.width / 2;
    const destinationY = destinationRect.top + destinationRect.height / 2;

    await mouse.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: sourceX,
      y: sourceY,
      button: 'left',
      clickCount: 1,
    });
    await mouse.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: sourceX,
      y: sourceY + 12,
      button: 'left',
      buttons: 1,
    });
    await mouse.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: destinationX,
      y: destinationY,
      button: 'left',
      buttons: 1,
    });
    await mouse.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: destinationX,
      y: destinationY,
      button: 'left',
      clickCount: 1,
    });

    expect(setQueue).toHaveBeenCalledTimes(1);
    expect(setQueue).toHaveBeenLastCalledWith([QUEUE[0], QUEUE[2], QUEUE[1]]);
  } finally {
    setQueue.mockRestore();
  }
});

test('keeps duplicated track IDs as separate keyboard-sortable queue entries', async () => {
  const duplicateIDQueue = [
    QUEUE[0],
    { ...QUEUE[1], id: 'duplicated-track-id', title: '重复曲目 A' },
    { ...QUEUE[2], id: 'duplicated-track-id', title: '重复曲目 B' },
  ];
  const setQueue = vi.spyOn(player, 'setQueue').mockImplementation(() => {});

  try {
    await render(
      <I18nProvider i18n={i18n}>
        <QueueList queue={duplicateIDQueue} queueCursor={0} />
      </I18nProvider>,
    );

    const handle = page.getByRole('button', { name: '重新排序 重复曲目 A' });
    handle.element().focus();
    await userEvent.keyboard('{Space}');
    await new Promise<void>((resolve) => window.setTimeout(resolve));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Space}');

    expect(setQueue).toHaveBeenLastCalledWith([
      duplicateIDQueue[0],
      duplicateIDQueue[2],
      duplicateIDQueue[1],
    ]);
  } finally {
    setQueue.mockRestore();
  }
});
