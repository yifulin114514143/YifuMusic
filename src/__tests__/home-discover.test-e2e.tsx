import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

function getGridColumnCount(element: HTMLElement) {
  return getComputedStyle(element)
    .gridTemplateColumns.split(' ')
    .filter(Boolean).length;
}

test('首页空状态不伪造推荐歌曲或队列操作', async () => {
  await getMainNavigation().getByRole('link', { name: '首页' }).click();

  await expect
    .element(page.getByText('音乐库为空', { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByTestId('home-add-all-to-queue'))
    .not.toBeInTheDocument();
  const unavailable = page.getByRole('button', {
    name: '每日在线推荐（服务接入后可用）',
  });
  await expect.element(unavailable).toBeDisabled();
  await expect.element(unavailable).toHaveAttribute('aria-disabled', 'true');
  await expect
    .element(unavailable)
    .toHaveAttribute('title', '每日在线推荐（服务接入后可用）');
  const radio = page.getByRole('button', {
    name: '私人电台（服务接入后可用）',
  });
  await expect.element(radio).toBeDisabled();
  await expect.element(radio).toHaveAttribute('aria-disabled', 'true');
  await expect
    .element(page.getByRole('heading', { name: '音乐榜单', level: 3 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('heading', { name: '精选歌单', level: 3 }))
    .toBeVisible();
});

test('首页仅展示真实本地推荐，并将全部本地歌曲加入唯一播放队列', async () => {
  await setupScannedLibrary();
  await getMainNavigation().getByRole('link', { name: '首页' }).click();

  await expect
    .element(page.getByRole('heading', { name: '每日推荐', level: 2 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('region', { name: '本地音乐入口', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: '播放 Whiskey Blues' }))
    .toBeVisible();

  const player = (await import('../lib/player')).default;
  const addToQueue = vi.spyOn(player, 'addToQueue');
  const start = vi.spyOn(player, 'start').mockResolvedValue();

  await page.getByRole('button', { name: '播放 Whiskey Blues' }).click();
  expect(start).toHaveBeenCalledTimes(1);
  expect(start.mock.calls.at(0)?.[0]).toHaveLength(3);

  await page.getByTestId('home-add-all-to-queue').click();

  expect(addToQueue).toHaveBeenCalledTimes(1);
  expect(addToQueue.mock.calls.at(0)?.[0]).toHaveLength(3);
});

test('发现页复刻四段滑块、键盘导航和真实本地歌曲回退', async () => {
  await setupScannedLibrary();
  await getMainNavigation().getByRole('link', { name: '发现' }).click();

  const tabList = page.getByRole('tablist', { name: '发现分类' });
  const playlist = page.getByRole('tab', { name: '发现歌单' });
  const ranking = page.getByRole('tab', { name: '音乐榜单' });
  const newAlbum = page.getByRole('tab', { name: '新碟上架' });
  const newSong = page.getByRole('tab', { name: '新歌速递' });

  await expect
    .element(tabList)
    .toHaveAttribute('data-reference-layout', 'moekoe-discover-switch');
  await expect.element(page.getByTestId('discover-arona')).toBeVisible();
  await expect.element(playlist).toHaveAttribute('aria-selected', 'true');
  await expect.element(ranking).toHaveAttribute('tabindex', '-1');
  expect(
    (page.getByTestId('discover-tab-indicator').element() as HTMLElement).style
      .transform,
  ).toBe('translateX(0%)');

  await ranking.click();
  await expect.element(ranking).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('当前不会显示虚构榜单。');
  expect(window.location.hash).toContain('view=ranking');
  expect(
    (page.getByTestId('discover-tab-indicator').element() as HTMLElement).style
      .transform,
  ).toBe('translateX(100%)');
  await expect
    .element(
      page.getByRole('button', {
        name: '服务接入后可用（服务接入后可用）',
      }),
    )
    .toBeDisabled();

  await userEvent.keyboard('[End]');
  await expect.element(newSong).toHaveFocus();
  await expect.element(newSong).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByRole('button', { name: '播放 Whiskey Blues' }))
    .toBeVisible();

  await userEvent.keyboard('[Home]');
  await expect.element(playlist).toHaveFocus();
  await expect.element(playlist).toHaveAttribute('aria-selected', 'true');
  await expect.element(newAlbum).toHaveAttribute('tabindex', '-1');

  await playlist.click();
  await userEvent.keyboard('[ArrowRight]');
  await expect.element(ranking).toHaveFocus();
  await expect.element(ranking).toHaveAttribute('aria-selected', 'true');
  expect(window.location.hash).toContain('view=ranking');

  await newAlbum.click();
  await userEvent.keyboard('[Enter]');
  await expect.element(newAlbum).toHaveAttribute('aria-selected', 'true');
  expect(window.location.hash).toContain('view=newAlbum');

  await newSong.click();
  await userEvent.keyboard(' ');
  await expect.element(newSong).toHaveAttribute('aria-selected', 'true');
  expect(window.location.hash).toContain('view=newSong');

  await playlist.click();
  expect(window.location.hash).not.toContain('view=');
});

test('1440px、1024px、700px 下首页和发现页保持可达布局', async () => {
  await setupScannedLibrary();
  await getMainNavigation().getByRole('link', { name: '首页' }).click();
  const homeGrid = page.getByTestId('home-track-grid').element() as HTMLElement;

  expect(getGridColumnCount(homeGrid)).toBe(5);
  await expect
    .element(page.getByRole('button', { name: '播放 Whiskey Blues' }))
    .toBeInViewport();

  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  expect(getGridColumnCount(homeGrid)).toBe(4);
  await expect
    .element(page.getByTestId('open-now-playing-button'))
    .toBeInViewport();

  await page.viewport(700, 700);
  window.dispatchEvent(new Event('resize'));

  expect(getGridColumnCount(homeGrid)).toBe(2);

  await getMainNavigation().getByRole('link', { name: '发现' }).click();
  await page.getByRole('tab', { name: '新歌速递' }).click();

  const discoverGrid = page
    .getByTestId('discover-track-grid')
    .element() as HTMLElement;
  expect(getGridColumnCount(discoverGrid)).toBe(2);
  await expect
    .element(page.getByRole('tab', { name: '新歌速递' }))
    .toBeInViewport();
  expect(
    getComputedStyle(
      page.getByTestId('discover-arona').element() as HTMLElement,
    ).display,
  ).toBe('none');
  await expect
    .element(page.getByTestId('open-now-playing-button'))
    .toBeInViewport();
});
