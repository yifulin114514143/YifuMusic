import { expect, test } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  getSystemNavigation,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('默认渲染使用中文，语言选择器仍可更新界面', async () => {
  await getSystemNavigation()
    .getByRole('link', { name: '设置', exact: true })
    .click();
  await page.getByRole('link', { name: '界面' }).click();
  await expect
    .element(page.getByRole('combobox', { name: '语言' }))
    .toHaveValue('zh-CN');
  await page.getByRole('combobox', { name: '语言' }).selectOptions('fr');

  await expect
    .element(page.getByRole('heading', { level: 1 }))
    .toHaveTextContent('Paramètres');
});

test('默认中文界面提供中文导航名称和 tooltip', async () => {
  await getSystemNavigation()
    .getByRole('link', { name: '设置', exact: true })
    .click();
  await page.getByRole('link', { name: '界面' }).click();
  await page.getByRole('combobox', { name: '语言' }).selectOptions('zh-CN');

  const navigations = [
    [getMainNavigation(), ['首页', '发现', '音乐库']],
    [page.getByRole('navigation', { name: '音乐库导航' }), ['本地音乐']],
    [page.getByRole('navigation', { name: '歌单导航' }), ['我的歌单']],
    [getSystemNavigation(), ['设置']],
  ] as const;

  for (const [navigation, labels] of navigations) {
    for (const label of labels) {
      const link = navigation.getByRole('link', { name: label, exact: true });

      await expect.element(link).toHaveAttribute('aria-label', label);
      await expect.element(link).toHaveAttribute('title', label);
    }
  }

  const iconButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-museeks-action]'),
  );

  expect(iconButtons.length).toBeGreaterThan(0);

  for (const button of iconButtons) {
    const label = button.getAttribute('aria-label') ?? '';
    const title = button.getAttribute('title') ?? '';

    expect(label).not.toBe('');
    expect(title).not.toBe('');
    expect(label).not.toMatch(/[A-Za-z]/);
    expect(title).not.toMatch(/[A-Za-z]/);
  }
});

test('默认中文覆盖设置、曲目详情、播放器、队列与本地页面状态', async () => {
  await getSystemNavigation()
    .getByRole('link', { name: '设置', exact: true })
    .click();

  const categories = page.getByRole('navigation', { name: '设置分类' });
  await expect
    .element(categories.getByRole('link', { name: '音乐库' }))
    .toHaveTextContent('音乐库');
  await expect
    .element(categories.getByRole('link', { name: '音频' }))
    .toHaveTextContent('音频');

  await setupScannedLibrary();
  window.location.hash = '#/tracks/0';

  await expect
    .element(page.getByRole('heading', { name: 'Whiskey Blues', level: 2 }))
    .toBeVisible();
  const trackMetadata = page.getByRole('region', {
    name: '本地曲目资料详情',
  });
  for (const label of ['专辑', '歌手', '流派', '年份', '文件位置']) {
    await expect
      .element(trackMetadata.getByText(label, { exact: true }))
      .toBeVisible();
  }
  await expect
    .element(page.getByRole('button', { name: '添加到队列' }))
    .toHaveAttribute('title', '添加到队列');

  window.location.hash = '#/library';
  await expect
    .element(page.getByRole('heading', { name: '音乐库', level: 1 }))
    .toBeVisible();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const playerHeader = page.getByRole('banner', { name: '播放器' });
  const desktopLyrics = playerHeader.getByRole('button', {
    name: '打开桌面歌词',
  });
  await expect.element(desktopLyrics).toHaveAttribute('title', '桌面歌词');
  await expect
    .element(playerHeader.getByRole('button', { name: '加入歌单' }))
    .toHaveAttribute('title', '加入歌单');
  await expect
    .element(playerHeader.getByRole('button', { name: '播放速度：1 倍' }))
    .toHaveAttribute('title', '播放速度');

  const queue = playerHeader.getByRole('button', { name: /播放队列/ });
  await expect
    .element(queue)
    .toHaveAttribute('title', expect.stringMatching(/播放队列/));
  await queue.click();
  await expect
    .element(page.getByRole('dialog', { name: '播放队列' }))
    .toBeVisible();

  window.location.hash = '#/search';
  await expect
    .element(
      page.getByText('输入关键词后，即可查看本地搜索结果。', {
        exact: true,
      }),
    )
    .toBeVisible();

  window.location.hash = '#/playlists';
  await expect
    .element(page.getByText('尚无播放列表', { exact: true }))
    .toBeVisible();
});
