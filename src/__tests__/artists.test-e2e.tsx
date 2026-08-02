import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import { beforeEachSetup, setupScannedLibrary } from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

test('Artists keeps a local overview instead of redirecting to the first artist', async () => {
  await setupScannedLibrary();

  window.location.hash = '#/artists';
  window.dispatchEvent(new HashChangeEvent('hashchange'));

  await expect
    .element(page.getByRole('heading', { name: '歌手', level: 2 }))
    .toBeInTheDocument();

  const overview = page.getByRole('region', { name: '本地歌手' });
  await expect
    .element(overview)
    .toHaveAttribute('data-reference-layout', 'moekoe-artist-grid');
  await expect
    .element(
      page.getByRole('link', { name: '打开歌手 Desicomix07', exact: true }),
    )
    .toHaveTextContent('1 首本地歌曲');
  await expect
    .element(
      page.getByRole('link', { name: '打开歌手 Jean-Paul-V', exact: true }),
    )
    .toHaveTextContent('1 张专辑 · 05:00');

  const services = page.getByTestId('artist-service-actions');
  const follow = services.getByRole('button', {
    name: '关注歌手，服务接入后可用',
  });
  await expect.element(follow).toBeDisabled();
  await expect
    .element(follow)
    .toHaveAttribute('title', '关注歌手：服务接入后可用');
});

test('Artist detail keeps the local profile and player actions reachable', async () => {
  await setupScannedLibrary();

  window.location.hash = '#/artists';
  window.dispatchEvent(new HashChangeEvent('hashchange'));

  await page
    .getByRole('link', { name: '打开歌手 Desicomix07', exact: true })
    .click();

  const profile = page.getByRole('region', {
    name: 'Desicomix07 本地歌手资料',
  });
  await expect
    .element(profile)
    .toHaveAttribute('data-reference-layout', 'moekoe-artist-detail');
  await expect.element(profile).toHaveTextContent('本地歌手');
  await expect
    .element(page.getByRole('button', { name: '播放全部' }))
    .toBeVisible();
  await expect
    .element(page.getByRole('button', { name: '全部添加到播放队列' }))
    .toBeVisible();

  const player = (await import('../lib/player')).default;
  const addToQueue = vi.spyOn(player, 'addToQueue');
  await page.getByRole('button', { name: '全部添加到播放队列' }).click();
  expect(addToQueue).toHaveBeenCalledWith([
    expect.objectContaining({ id: '1', title: 'Majestic Blues' }),
  ]);

  const services = page.getByTestId('artist-detail-service-actions');
  await expect
    .element(services.getByRole('button', { name: '远程专辑，服务接入后可用' }))
    .toBeDisabled();

  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  await expect.element(profile).toBeInTheDocument();
  await page.viewport(700, 700);
  window.dispatchEvent(new Event('resize'));
  await expect.element(services).toBeInTheDocument();
});
