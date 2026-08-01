import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import { beforeEachSetup, setupScannedLibrary } from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

test('曲目详情只显示真实本地元数据，并保留本地播放操作', async () => {
  await setupScannedLibrary();

  window.location.hash = '#/tracks/0';
  window.dispatchEvent(new HashChangeEvent('hashchange'));

  const detail = page.getByRole('region', {
    name: '本地曲目资料：Whiskey Blues',
  });
  await expect
    .element(detail)
    .toHaveAttribute('data-reference-layout', 'moekoe-track-detail');
  await expect.element(detail).toHaveTextContent('MP3');

  const metadata = page.getByRole('region', { name: '本地曲目资料详情' });
  await expect.element(metadata).toHaveTextContent('暂无本地文件信息');
  await expect.element(metadata).toHaveTextContent('/whiskey-blues.mp3');

  const player = (await import('../lib/player')).default;
  const start = vi.spyOn(player, 'start').mockResolvedValue();
  const addToQueue = vi.spyOn(player, 'addToQueue');
  const addNextInQueue = vi.spyOn(player, 'addNextInQueue');
  const actions = page.getByRole('group', { name: '曲目操作' });

  await actions.getByRole('button', { name: '播放', exact: true }).click();
  expect(start).toHaveBeenCalledWith(
    [expect.objectContaining({ id: '0', title: 'Whiskey Blues' })],
    '0',
    { type: 'library' },
  );

  await actions.getByRole('button', { name: '添加到队列' }).click();
  expect(addToQueue).toHaveBeenCalledWith([
    expect.objectContaining({ id: '0', title: 'Whiskey Blues' }),
  ]);

  await actions
    .getByRole('button', { name: '下一首播放 Whiskey Blues' })
    .click();
  expect(addNextInQueue).toHaveBeenCalledWith([
    expect.objectContaining({ id: '0', title: 'Whiskey Blues' }),
  ]);
  await expect
    .element(actions.getByRole('button', { name: '打开桌面歌词' }))
    .toHaveAttribute('title', '桌面歌词');
});

test('曲目详情的在线入口均保持禁用，并在窄窗口保持可达', async () => {
  await setupScannedLibrary();

  window.location.hash = '#/tracks/0';
  window.dispatchEvent(new HashChangeEvent('hashchange'));

  const services = page.getByTestId('track-detail-service-actions');
  for (const label of ['在线歌词', '远程专辑资料', '在线分享', 'MV']) {
    const action = services.getByRole('button', {
      name: `${label}，服务接入后可用`,
    });
    await expect.element(action).toBeDisabled();
    await expect.element(action).toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(action)
      .toHaveAttribute('title', `${label}：服务接入后可用`);
  }

  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  await expect.element(services).toBeInTheDocument();

  await page.viewport(700, 700);
  window.dispatchEvent(new Event('resize'));
  await expect
    .element(page.getByRole('group', { name: '曲目操作' }))
    .toBeInTheDocument();
});
