import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import { messages } from '../translations/zh-CN.po';

/* oxlint-disable typescript/unbound-method -- Vitest mock assertions intentionally inspect bridge methods. */

let DesktopLyricsBridge: typeof import('../lib/bridge-desktop-lyrics').default;
let toastManager: typeof import('../lib/toast-manager').default;
let DesktopLyricsButton: typeof import('./DesktopLyricsButton').default;

beforeEach(async () => {
  vi.resetModules();
  i18n.load('zh-CN', messages);
  i18n.activate('zh-CN');
  ({ default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics'));
  ({ default: toastManager } = await import('../lib/toast-manager'));
  ({ default: DesktopLyricsButton } = await import('./DesktopLyricsButton'));
  vi.spyOn(DesktopLyricsBridge, 'open').mockResolvedValue();
});

afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

test('桌面歌词打开成功后恢复按钮可用状态', async () => {
  await render(
    <I18nProvider i18n={i18n}>
      <DesktopLyricsButton />
    </I18nProvider>,
  );
  const button = page.getByTestId('open-desktop-lyrics-button');

  await button.click();

  await expect.element(button).toBeEnabled();
  expect(DesktopLyricsBridge.open).toHaveBeenCalledTimes(1);
});

test('桌面歌词打开失败后恢复按钮并显示中文错误', async () => {
  vi.mocked(DesktopLyricsBridge.open).mockRejectedValueOnce(
    new Error('window creation failed'),
  );
  const addToast = vi.spyOn(toastManager, 'add');
  await render(
    <I18nProvider i18n={i18n}>
      <DesktopLyricsButton />
    </I18nProvider>,
  );
  const button = page.getByTestId('open-desktop-lyrics-button');

  await button.click();

  await expect.element(button).toBeEnabled();
  expect(addToast).toHaveBeenCalledWith({
    title: '无法打开桌面歌词',
    type: 'danger',
  });
});

test('桌面歌词打开超时后恢复按钮并显示中文错误', async () => {
  vi.useFakeTimers();
  vi.mocked(DesktopLyricsBridge.open).mockImplementationOnce(
    () => new Promise(() => {}),
  );
  const addToast = vi.spyOn(toastManager, 'add');
  await render(
    <I18nProvider i18n={i18n}>
      <DesktopLyricsButton openTimeoutMs={50} />
    </I18nProvider>,
  );
  const button = page.getByTestId('open-desktop-lyrics-button');

  await button.click();
  await vi.advanceTimersByTimeAsync(50);

  await expect.element(button).toBeEnabled();
  expect(addToast).toHaveBeenCalledWith({
    title: '无法打开桌面歌词',
    type: 'danger',
  });
});
