import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import type {
  DesktopLyricsControlsBounds,
  DesktopLyricsWindowGeometry,
} from '../lib/bridge-desktop-lyrics';
import type { DesktopLyricsPayload } from '../lib/desktop-lyrics';

/* oxlint-disable typescript/unbound-method -- Vitest mock assertions intentionally inspect bridge methods. */

const PREFERENCES_STORAGE_KEY = 'desktop-lyrics-preferences';

const INITIAL_PAYLOAD: DesktopLyricsPayload = {
  trackId: 'desktop-lyrics-initial-track',
  title: '初始曲目',
  artists: ['初始歌手'],
  album: '初始专辑',
  currentTimeSeconds: 0,
  isPaused: true,
  lyricsKind: 'plain',
  lyrics: [
    { timeMs: null, text: '初始当前歌词' },
    { timeMs: null, text: '初始下一句歌词' },
  ],
};

const UPDATED_PAYLOAD: DesktopLyricsPayload = {
  trackId: 'desktop-lyrics-updated-track',
  title: '更新曲目',
  artists: ['更新歌手'],
  album: '更新专辑',
  currentTimeSeconds: 5,
  isPaused: false,
  lyricsKind: 'plain',
  lyrics: [
    { timeMs: null, text: '更新当前歌词' },
    { timeMs: null, text: '更新下一句歌词' },
  ],
};

let DesktopLyricsWindow: typeof import('./DesktopLyricsWindow').default;
let DesktopLyricsBridge: typeof import('../lib/bridge-desktop-lyrics').default;
let getResizeCursor: typeof import('./DesktopLyricsWindow').getResizeCursor;
let getResizeDirection: typeof import('./DesktopLyricsWindow').getResizeDirection;
let getResizedGeometry: typeof import('./DesktopLyricsWindow').getResizedGeometry;
let stateListener: ((payload: DesktopLyricsPayload) => void) | undefined;

beforeEach(async () => {
  vi.resetModules();
  window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  stateListener = undefined;

  ({ default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics'));

  vi.spyOn(DesktopLyricsBridge, 'getState').mockResolvedValue(INITIAL_PAYLOAD);
  vi.spyOn(DesktopLyricsBridge, 'listenForState').mockImplementation(
    async (callback) => {
      stateListener = callback;
      return () => {};
    },
  );
  vi.spyOn(DesktopLyricsBridge, 'sendControl').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'setMousePassthrough').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'getWindowGeometry').mockResolvedValue({
    x: 100,
    y: 100,
    width: 900,
    height: 180,
    scaleFactor: 1,
  });
  vi.spyOn(DesktopLyricsBridge, 'updateWindowGeometry').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'setAlwaysOnTop').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'setResizable').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'close').mockResolvedValue();
  vi.spyOn(DesktopLyricsBridge, 'startDragging').mockResolvedValue();

  ({
    default: DesktopLyricsWindow,
    getResizeCursor,
    getResizeDirection,
    getResizedGeometry,
  } = await import('./DesktopLyricsWindow'));
});

afterEach(async () => {
  await cleanup();
  window.localStorage.removeItem(PREFERENCES_STORAGE_KEY);
  vi.restoreAllMocks();
  vi.resetModules();
});

function getStateListener() {
  if (stateListener === undefined) {
    throw new Error('桌面歌词状态监听器尚未注册');
  }

  return stateListener;
}

test('读取初始状态，并在状态事件后更新当前和下一句歌词', async () => {
  await render(<DesktopLyricsWindow />);

  await expect
    .element(page.getByText('初始当前歌词', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('初始下一句歌词', { exact: true }))
    .toBeVisible();
  expect(DesktopLyricsBridge.getState).toHaveBeenCalledTimes(1);
  expect(DesktopLyricsBridge.listenForState).toHaveBeenCalledTimes(1);

  getStateListener()(UPDATED_PAYLOAD);

  await expect
    .element(page.getByText('更新当前歌词', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('更新下一句歌词', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText('初始当前歌词', { exact: true }))
    .not.toBeInTheDocument();
});

test('将播放控制、关闭按钮和 Escape 发送到桌面歌词桥接层', async () => {
  await render(<DesktopLyricsWindow />);

  await page.getByRole('button', { name: '上一首' }).click();
  await page.getByRole('button', { name: '播放' }).click();
  await page.getByRole('button', { name: '下一首' }).click();
  await page.getByRole('button', { name: '关闭桌面歌词' }).click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  expect(DesktopLyricsBridge.sendControl).toHaveBeenNthCalledWith(
    1,
    'previous',
  );
  expect(DesktopLyricsBridge.sendControl).toHaveBeenNthCalledWith(
    2,
    'play-pause',
  );
  expect(DesktopLyricsBridge.sendControl).toHaveBeenNthCalledWith(3, 'next');
  expect(DesktopLyricsBridge.close).toHaveBeenCalledTimes(2);
});

test('八方向缩放命中、cursor 和左上边尺寸计算正确', () => {
  expect(getResizeDirection(0, 0, 900, 180)).toBe('nw');
  expect(getResizeDirection(899, 0, 900, 180)).toBe('ne');
  expect(getResizeDirection(899, 179, 900, 180)).toBe('se');
  expect(getResizeDirection(0, 179, 900, 180)).toBe('sw');
  expect(getResizeDirection(450, 0, 900, 180)).toBe('n');
  expect(getResizeDirection(899, 90, 900, 180)).toBe('e');
  expect(getResizeDirection(450, 179, 900, 180)).toBe('s');
  expect(getResizeDirection(0, 90, 900, 180)).toBe('w');
  expect(getResizeCursor('nw')).toBe('nwse-resize');
  expect(getResizeCursor('e')).toBe('ew-resize');

  const geometry: DesktopLyricsWindowGeometry = {
    x: 100,
    y: 100,
    width: 900,
    height: 180,
    scaleFactor: 1,
  };
  expect(
    getResizedGeometry(
      { direction: 'nw', geometry, startClientX: 200, startClientY: 200 },
      350,
      260,
    ),
  ).toStrictEqual({
    x: 200,
    y: 152,
    width: 800,
    height: 128,
    scaleFactor: 1,
  });
  expect(
    getResizedGeometry(
      { direction: 'se', geometry, startClientX: 200, startClientY: 200 },
      500,
      400,
    ),
  ).toStrictEqual({
    x: 100,
    y: 100,
    width: 1200,
    height: 380,
    scaleFactor: 1,
  });
});

test('歌词内容启动原生窗口拖动，控制栏不开始拖动', async () => {
  await render(<DesktopLyricsWindow />);
  vi.mocked(DesktopLyricsBridge.setMousePassthrough).mockClear();
  vi.mocked(DesktopLyricsBridge.startDragging).mockClear();

  page
    .getByLabelText('桌面歌词内容')
    .element()
    .dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 100,
      }),
    );
  expect(DesktopLyricsBridge.startDragging).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new MouseEvent('mouseup'));

  await page.getByRole('button', { name: '上一首' }).click();
  expect(DesktopLyricsBridge.startDragging).toHaveBeenCalledTimes(1);

  await page.getByRole('button', { name: '锁定桌面歌词布局' }).click();
  page
    .getByLabelText('桌面歌词内容')
    .element()
    .dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 100,
      }),
    );
  expect(DesktopLyricsBridge.startDragging).toHaveBeenCalledTimes(1);

  await expect
    .element(page.getByRole('button', { name: '解锁桌面歌词布局' }))
    .toBeVisible();
  expect(
    page
      .getByLabelText('桌面歌词', { exact: true })
      .element()
      .getAttribute('data-locked'),
  ).toBe('true');

  await page.getByRole('button', { name: '开启鼠标穿透' }).click();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  const passthroughCall = vi
    .mocked(DesktopLyricsBridge.setMousePassthrough)
    .mock.calls.find(
      (call): call is [true, DesktopLyricsControlsBounds] =>
        call[0] && call[1] !== null,
    );

  if (passthroughCall === undefined) {
    throw new Error('开启鼠标穿透后没有同步控制栏范围');
  }

  expect(passthroughCall[1].devicePixelRatio).toBe(window.devicePixelRatio);
});

test('始终置顶切换调用专用桥接并持久化', async () => {
  await render(<DesktopLyricsWindow />);
  vi.mocked(DesktopLyricsBridge.setAlwaysOnTop).mockClear();

  await page.getByRole('button', { name: '关闭始终置顶' }).click();

  expect(DesktopLyricsBridge.setAlwaysOnTop).toHaveBeenCalledWith(false);
  expect(
    JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null'),
  ).toMatchObject({ isAlwaysOnTop: false });
});

test('锁定布局时关闭原生 resize，解锁后恢复', async () => {
  await render(<DesktopLyricsWindow />);
  vi.mocked(DesktopLyricsBridge.setResizable).mockClear();

  await page.getByRole('button', { name: '锁定桌面歌词布局' }).click();
  expect(DesktopLyricsBridge.setResizable).toHaveBeenCalledWith(false);

  await page.getByRole('button', { name: '解锁桌面歌词布局' }).click();
  expect(DesktopLyricsBridge.setResizable).toHaveBeenCalledWith(true);
});

test('保存歌词颜色和字号，并在重新渲染后恢复这些偏好', async () => {
  await render(<DesktopLyricsWindow />);

  const defaultColor = page.getByLabelText('默认歌词颜色');
  const highlightColor = page.getByLabelText('高亮歌词颜色');
  await defaultColor.fill('#123456');
  await highlightColor.fill('#654321');
  await page.getByRole('button', { name: '增大歌词字号' }).click();
  await page.getByRole('button', { name: '增大歌词字号' }).click();

  await expect.element(defaultColor).toHaveValue('#123456');
  await expect.element(highlightColor).toHaveValue('#654321');
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

  expect(
    JSON.parse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null'),
  ).toStrictEqual({
    defaultColor: '#123456',
    highlightColor: '#654321',
    fontSize: 36,
    isAlwaysOnTop: true,
    isLocked: false,
    isMousePassthrough: false,
  });
  expect(
    (page.getByText('初始当前歌词', { exact: true }).element() as HTMLElement)
      .style.fontSize,
  ).toBe('36px');

  await cleanup();
  await render(<DesktopLyricsWindow />);

  await expect
    .element(page.getByLabelText('默认歌词颜色'))
    .toHaveValue('#123456');
  await expect
    .element(page.getByLabelText('高亮歌词颜色'))
    .toHaveValue('#654321');
  expect(
    (page.getByText('初始当前歌词', { exact: true }).element() as HTMLElement)
      .style.fontSize,
  ).toBe('36px');
});
