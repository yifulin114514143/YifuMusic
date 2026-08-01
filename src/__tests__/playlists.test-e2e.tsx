import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import type { Playlist } from '../generated/typings';
import { beforeEachSetup } from './e2e-helpers';

const IMPORTED_PLAYLIST: Playlist = {
  id: 'playlist-imported',
  name: '夏夜精选',
  tracks: ['track-1', 'track-2'],
  import_path: '/Users/mico/Music/夏夜精选.m3u',
};

const MANUAL_PLAYLIST: Playlist = {
  id: 'playlist-manual',
  name: '通勤歌单',
  tracks: ['track-3'],
  import_path: null,
};

beforeEachSetup();

test('Empty playlists retain the rebuilt overview, category tabs, and creation entry', async () => {
  window.location.hash = '#/playlists';

  const overview = page.getByTestId('playlist-overview');
  await expect.element(overview).toBeVisible();
  await expect
    .element(page.getByRole('heading', { name: '我的歌单', level: 1 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('尚无播放列表');
  await expect
    .element(page.getByRole('tablist', { name: '歌单分类' }))
    .toBeVisible();
  await expect
    .element(overview.getByRole('button', { name: '创建播放列表' }))
    .toBeVisible();
  await expect
    .element(page.getByRole('link', { name: '导入本地歌单' }))
    .toHaveAttribute('title', '导入本地歌单');
  const onlineCollection = page.getByRole('button', {
    name: '在线收藏歌单，服务接入后可用',
  });
  await expect.element(onlineCollection).toBeDisabled();
  await expect
    .element(onlineCollection)
    .toHaveAttribute('title', '在线收藏歌单：服务接入后可用');
  await expect
    .element(page.getByText('No playlists yet'))
    .not.toBeInTheDocument();
});

test('Playlist overview keeps a page-level local error state', async () => {
  const { default: DatabaseBridge } = await import('../lib/bridge-database');
  const getAllPlaylists = vi
    .spyOn(DatabaseBridge, 'getAllPlaylists')
    .mockRejectedValue(new Error('读取失败'));

  try {
    window.location.hash = '#/playlists';
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('无法读取本地歌单，请稍后重试。');
  } finally {
    getAllPlaylists.mockRestore();
  }
});

test('Local playlists stay on the MoeKoe-style overview and expose only local playlist data', async () => {
  const { default: DatabaseBridge } = await import('../lib/bridge-database');
  const getAllPlaylists = vi
    .spyOn(DatabaseBridge, 'getAllPlaylists')
    .mockResolvedValue([IMPORTED_PLAYLIST, MANUAL_PLAYLIST]);
  const getPlaylist = vi
    .spyOn(DatabaseBridge, 'getPlaylist')
    .mockImplementation(async (id) => {
      return id === IMPORTED_PLAYLIST.id ? IMPORTED_PLAYLIST : MANUAL_PLAYLIST;
    });

  try {
    window.location.hash = '#/playlists';

    const overview = page.getByTestId('playlist-overview');
    await expect.element(overview).toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: '我的歌单', level: 1 }))
      .toBeVisible();
    expect(window.location.hash).toBe('#/playlists');

    const grid = page.getByTestId('playlist-grid');
    expect(getComputedStyle(grid.element() as HTMLElement).display).toBe(
      'grid',
    );
    await expect
      .element(overview.getByRole('button', { name: '创建播放列表' }))
      .toBeVisible();

    const importedPlaylist = overview.getByRole('link', { name: '夏夜精选' });
    await expect
      .element(importedPlaylist)
      .toHaveAttribute('data-playlist-source', 'imported');
    await expect.element(importedPlaylist).toHaveTextContent('2 首歌');
    await expect
      .element(importedPlaylist)
      .toHaveTextContent(IMPORTED_PLAYLIST.import_path ?? '');

    const manualPlaylist = overview.getByRole('link', { name: '通勤歌单' });
    await expect
      .element(manualPlaylist)
      .toHaveAttribute('data-playlist-source', 'manual');
    await expect.element(manualPlaylist).toHaveTextContent('1 首歌');
    await expect.element(manualPlaylist).toHaveTextContent('手动创建');
    await expect.element(overview.getByRole('img')).not.toBeInTheDocument();

    const categoryTabs = page.getByRole('tablist', { name: '歌单分类' });
    await categoryTabs.getByRole('tab', { name: '从文件导入' }).click();
    await expect.element(importedPlaylist).toBeVisible();
    await expect.element(manualPlaylist).not.toBeInTheDocument();

    await categoryTabs.getByRole('tab', { name: '手动创建' }).click();
    const visibleManualPlaylist = overview.getByRole('link', {
      name: '通勤歌单',
    });
    await expect.element(visibleManualPlaylist).toBeVisible();
    await visibleManualPlaylist.click();
    await expect
      .element(page.getByRole('heading', { name: '通勤歌单', level: 2 }))
      .toBeVisible();
    const serviceActions = page.getByRole('group', { name: '歌单管理' });
    await expect
      .element(
        serviceActions.getByRole('button', {
          name: '在线收藏歌单，服务接入后可用',
        }),
      )
      .toBeDisabled();
    await expect
      .element(
        serviceActions.getByRole('button', {
          name: '分享歌单，服务接入后可用',
        }),
      )
      .toBeDisabled();

    await page.viewport(1440, 900);
    window.dispatchEvent(new Event('resize'));
    await expect
      .element(page.getByTestId('playlist-detail-tracks'))
      .toBeInTheDocument();

    await page.viewport(1024, 768);
    window.dispatchEvent(new Event('resize'));
    await expect
      .element(page.getByTestId('playlist-detail-tracks'))
      .toBeInTheDocument();
    await page.viewport(700, 700);
    window.dispatchEvent(new Event('resize'));
    await expect
      .element(page.getByRole('button', { name: '返回歌单' }))
      .toBeInTheDocument();
  } finally {
    getPlaylist.mockRestore();
    getAllPlaylists.mockRestore();
  }
});
