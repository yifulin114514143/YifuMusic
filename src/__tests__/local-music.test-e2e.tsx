import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { render } from 'vitest-browser-react';

import { beforeEachSetup } from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

test('本地音乐加载时使用详情头与曲目行骨架屏', async () => {
  const { LocalMusicLoadingSkeleton } = await import('../routes/local-music');
  await render(<LocalMusicLoadingSkeleton />);

  const skeleton = page.getByTestId('local-music-loading-skeleton');
  await expect.element(skeleton).toHaveAttribute('aria-busy', 'true');
  await expect.element(skeleton).toHaveTextContent('正在读取本地音乐...');
  expect(
    document.querySelectorAll('[data-testid="local-music-loading-row"]'),
  ).toHaveLength(6);
});

async function openScannedLocalMusic() {
  const ConfigBridge = (await import('../lib/bridge-config')).default;
  await ConfigBridge.set('library_folders', ['/']);

  await page.getByRole('link', { name: '本地音乐', exact: true }).click();
  await page.getByRole('button', { name: '扫描已添加的音乐文件夹' }).click();
  await expect
    .element(page.getByTestId('local-music-track-list'))
    .toBeVisible();
}

test('本地音乐页只使用已扫描且属于当前文件夹的曲目', async () => {
  await openScannedLocalMusic();

  const localTrackList = page.getByTestId('local-music-track-list');
  await expect
    .element(localTrackList.getByText('whiskey-blues.mp3'))
    .toBeVisible();
  await expect
    .element(localTrackList.getByText('majestic-blues.mp3'))
    .toBeVisible();
  await expect
    .element(localTrackList.getByText('romantic-blues.mp3'))
    .toBeVisible();
  await expect.element(localTrackList.getByText('文件大小')).toBeVisible();
  await expect.element(localTrackList.getByText('当前播放状态')).toBeVisible();
  await expect
    .element(localTrackList.getByText('暂无本地文件信息').first())
    .toBeVisible();

  const localSearch = page.getByRole('textbox', { name: '搜索本地歌曲' });
  await localSearch.fill('Majestic');

  await expect
    .element(localTrackList.getByText('majestic-blues.mp3'))
    .toBeVisible();
  await expect
    .element(localTrackList.getByText('whiskey-blues.mp3'))
    .not.toBeInTheDocument();
});

test('播放全部、批量选择和批量入队都作用于真实本地曲目', async () => {
  await openScannedLocalMusic();

  const player = (await import('../lib/player')).default;
  const start = vi.spyOn(player, 'start').mockResolvedValue();
  const addToQueue = vi.spyOn(player, 'addToQueue');

  await page.getByRole('button', { name: '播放当前文件夹的全部歌曲' }).click();
  expect(start).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ id: '0', title: 'Whiskey Blues' }),
    ]),
    '0',
    { type: 'library' },
  );

  await page.getByText('majestic-blues.mp3', { exact: true }).click();
  expect(start).toHaveBeenLastCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ id: '1', title: 'Majestic Blues' }),
    ]),
    '1',
    { type: 'library' },
  );

  await page.getByRole('button', { name: '切换到网格视图' }).click();
  await page.getByRole('button', { name: '进入批量选择' }).click();
  const checkbox = page.getByRole('checkbox', {
    name: '选择 majestic-blues.mp3',
  });
  await checkbox.click();
  await page.getByRole('button', { name: '将所选歌曲加入播放队列' }).click();

  expect(addToQueue).toHaveBeenCalledWith([
    expect.objectContaining({ id: '1', title: 'Majestic Blues' }),
  ]);
  await expect.element(checkbox).not.toBeInTheDocument();
});

test('批量选择可全选，退出后清空所有选择', async () => {
  await openScannedLocalMusic();

  await page.getByRole('button', { name: '进入批量选择' }).click();
  await page.getByRole('button', { name: '全选当前列表' }).click();

  for (const fileName of [
    'whiskey-blues.mp3',
    'majestic-blues.mp3',
    'romantic-blues.mp3',
  ]) {
    await expect
      .element(page.getByRole('checkbox', { name: `选择 ${fileName}` }))
      .toBeChecked();
  }

  await page.getByRole('button', { name: '退出批量选择' }).click();
  await expect
    .element(page.getByRole('checkbox', { name: '选择 whiskey-blues.mp3' }))
    .not.toBeInTheDocument();
  await expect.element(page.getByText('已选择 0 首')).not.toBeInTheDocument();
});

test('本地音乐列表表头全选与网格信息保持一致', async () => {
  await openScannedLocalMusic();

  await page.getByRole('button', { name: '进入批量选择' }).click();
  const headerCheckbox = page.getByRole('checkbox', {
    name: '选择当前可见的全部歌曲',
  });
  await headerCheckbox.click();
  await expect.element(headerCheckbox).toBeChecked();
  await expect
    .element(page.getByRole('checkbox', { name: '选择 whiskey-blues.mp3' }))
    .toBeChecked();

  await page.getByRole('button', { name: '切换到网格视图' }).click();
  await expect.element(page.getByText('MP3').first()).toBeVisible();
  await expect
    .element(page.getByText('暂无本地文件信息').first())
    .toBeVisible();
  await expect.element(page.getByText('未播放').first()).toBeVisible();
});

test('本地列表显示可切换的排序方向', async () => {
  await openScannedLocalMusic();

  const filenameSort = page.getByRole('button', { name: /按文件名排序/ });
  const initialDirection = filenameSort
    .element()
    .getAttribute('data-sort-direction');
  expect(['ascending', 'descending']).toContain(initialDirection);

  await filenameSort.click();
  await expect
    .element(filenameSort)
    .toHaveAttribute(
      'data-sort-direction',
      initialDirection === 'ascending' ? 'descending' : 'ascending',
    );
});

test('本地音乐详情头随 AppShell 的滚动容器收缩并恢复', async () => {
  await openScannedLocalMusic();

  const mainContent = page
    .getByTestId('app-shell-main-content')
    .element() as HTMLElement;
  let scrollTop = 0;
  Object.defineProperty(mainContent, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
  });

  scrollTop = 100;
  mainContent.dispatchEvent(new Event('scroll'));
  await expect
    .element(page.getByTestId('local-music-sticky-header'))
    .toHaveAttribute('data-collapsed', 'true');

  scrollTop = 0;
  mainContent.dispatchEvent(new Event('scroll'));
  await expect
    .element(page.getByTestId('local-music-sticky-header'))
    .not.toHaveAttribute('data-collapsed', 'true');
});

test('最近文件夹最多保留十项，移除历史不改动资料库配置', async () => {
  const ConfigBridge = (await import('../lib/bridge-config')).default;
  const folders = Array.from({ length: 11 }, (_, index) => `/folder-${index}`);
  await ConfigBridge.set('library_folders', folders);
  window.localStorage.setItem(
    'yifu-local-music-folder-history',
    JSON.stringify(folders),
  );

  await page.getByRole('link', { name: '本地音乐', exact: true }).click();
  await page.getByRole('button', { name: '快速切换音乐文件夹' }).click();

  expect(
    JSON.parse(
      window.localStorage.getItem('yifu-local-music-folder-history') ?? '[]',
    ),
  ).toHaveLength(10);

  await page
    .getByRole('button', { name: '从最近文件夹中移除 folder-0' })
    .click();
  await expect
    .element(page.getByRole('menuitem', { name: 'folder-0' }))
    .not.toBeInTheDocument();
  expect(await ConfigBridge.get('library_folders')).toEqual(folders);
});

test('切换最近文件夹时重新扫描现有资料库', async () => {
  const ConfigBridge = (await import('../lib/bridge-config')).default;
  await ConfigBridge.set('library_folders', ['/', '/archive']);
  window.localStorage.setItem(
    'yifu-local-music-folder-history',
    JSON.stringify(['/', '/archive']),
  );
  const LibraryAPI = (await import('../api/LibraryAPI')).default;
  const scan = vi.spyOn(LibraryAPI, 'scan').mockResolvedValue();

  await page.getByRole('link', { name: '本地音乐', exact: true }).click();
  await page.getByRole('button', { name: '快速切换音乐文件夹' }).click();
  await page.getByRole('menuitem', { name: 'archive' }).click();

  expect(scan).toHaveBeenCalledTimes(1);
});

test('700px 下本地歌曲工具栏和网格仍可操作', async () => {
  await openScannedLocalMusic();
  await page.viewport(700, 900);

  await page.getByRole('button', { name: '切换到网格视图' }).click();
  await expect
    .element(page.getByRole('button', { name: '播放 Whiskey Blues' }))
    .toBeVisible();
  await expect
    .element(page.getByRole('textbox', { name: '搜索本地歌曲' }))
    .toBeVisible();
});

test('本地音乐网格在 1440px、1024px、700px 下保持响应式列数', async () => {
  await openScannedLocalMusic();
  await page.getByRole('button', { name: '切换到网格视图' }).click();

  const grid = page.getByRole('grid', { name: '本地歌曲网格' });
  const getColumnCount = () =>
    getComputedStyle(grid.element() as HTMLElement).gridTemplateColumns.split(
      ' ',
    ).length;

  expect(getColumnCount()).toBe(5);

  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  expect(getColumnCount()).toBe(4);

  await page.viewport(700, 700);
  window.dispatchEvent(new Event('resize'));
  expect(getColumnCount()).toBe(2);
});
