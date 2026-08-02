import { expect, test } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

function getPageHeader(pageTitle = '音乐库') {
  const title = page
    .getByRole('heading', { name: pageTitle, level: 1 })
    .element();
  const header = title.closest('header');

  if (header === null) {
    throw new Error('音乐库页面标题未包含在顶栏中');
  }

  return page.elementLocator(header);
}

function getPageHeaderSearch(pageTitle = '音乐库') {
  return getPageHeader(pageTitle).getByRole('textbox', {
    name: '搜索音乐库',
  });
}

test('Enter opens the local MoeKoe-style search page with its q workflow', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  await search.fill('Pixabay');
  await userEvent.keyboard('{Enter}');

  await expect
    .element(page.getByRole('heading', { name: '搜索结果', level: 2 }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('tab', { name: '综合' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(page.getByText('单曲（2）')).toBeInTheDocument();
  await expect.element(page.getByText('专辑（2）')).toBeInTheDocument();
});

test('Search type tabs show only real local data and preserve the MV boundary', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  await search.fill('Pixabay');
  await userEvent.keyboard('{Enter}');

  const songTab = page.getByRole('tab', { name: '单曲' });
  await songTab.click();
  await expect.element(songTab).toHaveAttribute('aria-selected', 'true');
  await expect.element(getTrackByName(/Majestic Blues/)).toBeInTheDocument();
  await expect.element(getTrackByName(/Romantic Blues/)).toBeInTheDocument();

  const mvTab = page.getByRole('tab', { name: 'MV' });
  await mvTab.click();
  await expect.element(mvTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('MV 搜索将在服务接入后可用；当前不会显示虚构结果。');
  await expect
    .element(page.getByRole('button', { name: '在线 MV 搜索服务接入后可用' }))
    .toBeDisabled();
});

test('搜索分类以 q/type 同步 URL，并支持左右方向键切换本地分类', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  await search.fill('Pixabay');
  await userEvent.keyboard('{Enter}');

  const tabs = page.getByRole('tablist', { name: '搜索分类' });
  const complexTab = tabs.getByRole('tab', { name: '综合' });
  (complexTab.element() as HTMLButtonElement).focus();
  await userEvent.keyboard('{ArrowRight}');

  const songTab = tabs.getByRole('tab', { name: '单曲' });
  await expect.element(songTab).toHaveFocus();
  await expect.element(songTab).toHaveAttribute('aria-selected', 'true');
  expect(window.location.hash).toContain('type=song');
  expect(window.location.hash).toContain('q=Pixabay');

  const resultSearch = getPageHeaderSearch('搜索');
  await resultSearch.fill('Whiskey');
  await expect
    .element(page.getByText('正在本地音乐中搜索“Whiskey”'))
    .toBeVisible();
  expect(window.location.hash).toContain('q=Whiskey');
});

test('搜索页在 1440、1024 与 700px 保持标签和本地结果可达', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  await search.fill('Pixabay');
  await userEvent.keyboard('{Enter}');

  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [700, 700],
  ] as const) {
    await page.viewport(width, height);
    window.dispatchEvent(new Event('resize'));

    await expect
      .element(page.getByRole('tab', { name: '单曲' }))
      .toBeInViewport();
    await expect.element(getTrackByName(/Majestic Blues/)).toBeInViewport();
  }
});

test('搜索结果页允许改写或清空直链关键词，不会被旧 q 参数覆盖', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  await search.fill('Pixabay');
  await userEvent.keyboard('{Enter}');

  const resultSearch = getPageHeaderSearch('搜索');
  await resultSearch.fill('Whiskey');

  await expect
    .element(page.getByText('正在本地音乐中搜索“Whiskey”'))
    .toBeVisible();
  await expect.element(resultSearch).toHaveValue('Whiskey');

  await getPageHeader('搜索').getByRole('button', { name: '清除搜索' }).click();

  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('输入关键词后，即可查看本地搜索结果。');
  expect(window.location.hash).not.toContain('q=');
});
