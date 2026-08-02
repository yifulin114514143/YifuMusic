import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

function prepareScrollableMainContent() {
  const mainContent = page
    .getByTestId('app-shell-main-content')
    .element() as HTMLElement;
  let scrollTop = 0;
  const scrollTo = vi.fn<(options: ScrollToOptions) => void>();

  Object.defineProperty(mainContent, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(mainContent, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });

  return {
    mainContent,
    scrollTo,
    scrollToPosition: (position: number) => {
      scrollTop = position;
      mainContent.dispatchEvent(new Event('scroll'));
    },
  };
}

test('首页的回到顶部入口使用 AppShell 的实际滚动容器', async () => {
  await getMainNavigation().getByRole('link', { name: '首页' }).click();
  await expect.element(page.getByTestId('back-to-top')).not.toBeInTheDocument();

  const { scrollTo, scrollToPosition } = prepareScrollableMainContent();
  scrollToPosition(240);

  const backToTop = page.getByTestId('back-to-top');
  await expect.element(backToTop).toBeVisible();
  await expect.element(backToTop).toHaveAttribute('title', '回到顶部');
  await backToTop.click();

  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
});

test('音乐库的播放全部只传入真实扫描曲目', async () => {
  await setupScannedLibrary();

  const player = (await import('../lib/player')).default;
  const start = vi.spyOn(player, 'start');

  await page.getByTestId('library-play-all').click();

  expect(start).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ id: '0', title: 'Whiskey Blues' }),
    ]),
    '0',
    { type: 'library' },
  );
});
