import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackAt,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

function getPageHeader(pageTitle: string) {
  const title = page
    .getByRole('heading', { name: pageTitle, level: 1 })
    .element();
  const header = title.closest('header');

  if (header === null) {
    throw new Error(`${pageTitle} 页面标题未包含在顶栏中`);
  }

  return page.elementLocator(header);
}

function getPageHeaderSearch(pageTitle: string) {
  return getPageHeader(pageTitle).getByRole('textbox', {
    name: '搜索音乐库',
  });
}

test('Library shows local statistics and Escape clears the current search', async () => {
  await setupScannedLibrary();

  await expect
    .element(page.getByRole('heading', { name: '音乐库', level: 2 }))
    .toBeInTheDocument();
  await expect.element(page.getByText('3 首音轨 / 15:00')).toBeInTheDocument();

  const search = getPageHeaderSearch('音乐库');
  await search.fill('Nothing matches this search');
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('没有与“Nothing matches this search”匹配的结果');

  await userEvent.keyboard('{Escape}');
  await expect.element(search).toHaveValue('');
  await expect.element(getTrackAt(0)).toBeInTheDocument();
});

test('Artists retain backend order while filtering by the global search', async () => {
  const { default: DatabaseBridge } = await import('../lib/bridge-database');
  vi.spyOn(DatabaseBridge, 'getAllArtists').mockResolvedValue([
    'Éclair',
    'Alpha',
  ]);

  window.location.hash = '#/artists';
  await expect
    .element(page.getByRole('heading', { name: '艺术家', level: 1 }))
    .toBeInTheDocument();

  const artistLinks = page.getByRole('link', { name: /Éclair|Alpha/ });
  await expect.element(artistLinks.nth(0)).toHaveTextContent('Éclair');
  await expect.element(artistLinks.nth(1)).toHaveTextContent('Alpha');
  await expect.element(page.getByText('2 位本地歌手')).toBeInTheDocument();

  const search = getPageHeaderSearch('艺术家');
  await search.fill('ecl');

  await expect
    .element(page.getByRole('link', { name: 'Éclair' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('link', { name: 'Alpha' }))
    .not.toBeInTheDocument();
});

test('Empty playlists use the rebuilt overview and explain the existing M3U scan path', async () => {
  await page
    .getByRole('navigation', { name: '歌单导航' })
    .getByRole('link', { name: '我的歌单', exact: true })
    .click();

  const emptyState = page.getByRole('status');
  await expect.element(emptyState).toHaveTextContent('尚无播放列表');
  await expect
    .element(emptyState)
    .toHaveTextContent(
      '可在此创建歌单，或在音乐库设置中扫描包含 .m3u 文件的音乐文件夹以导入歌单。',
    );
  await expect
    .element(page.getByRole('button', { name: '创建播放列表' }))
    .toBeInTheDocument();
});

test('Side title bar and library sections keep only real local capabilities', async () => {
  const pageHeader = getPageHeader('音乐库');
  const toolbar = pageHeader.getByRole('toolbar');

  await expect
    .element(toolbar.getByRole('button', { name: '收起侧边栏' }))
    .toBeInTheDocument();
  await expect
    .element(toolbar.getByRole('button', { name: '返回' }))
    .toBeInTheDocument();
  await expect
    .element(toolbar.getByRole('button', { name: '前进' }))
    .toBeInTheDocument();
  await expect
    .element(toolbar.getByRole('button', { name: '刷新页面' }))
    .toBeInTheDocument();
  const recognitionButton = toolbar.getByRole('button', {
    name: '听歌识曲（服务接入后可用）',
  });
  await expect.element(recognitionButton).toBeInTheDocument();
  expect((recognitionButton.element() as HTMLButtonElement).disabled).toBe(
    true,
  );
  await expect.element(getPageHeaderSearch('音乐库')).toBeInTheDocument();

  const libraryNavigation = page.getByRole('navigation', {
    name: '音乐库导航',
  });
  await expect
    .element(
      libraryNavigation.getByRole('link', { name: '本地音乐', exact: true }),
    )
    .toBeInTheDocument();
  await expect
    .element(
      libraryNavigation.getByRole('button', {
        name: '我的云盘（服务接入后可用）',
      }),
    )
    .toHaveAttribute('aria-disabled', 'true');
  await expect
    .element(
      libraryNavigation.getByRole('button', {
        name: '听歌识曲（服务接入后可用）',
      }),
    )
    .toHaveAttribute('aria-disabled', 'true');
  await expect
    .element(
      page
        .getByRole('navigation', { name: '歌单导航' })
        .getByRole('link', { name: '我的歌单', exact: true }),
    )
    .toBeInTheDocument();
});
