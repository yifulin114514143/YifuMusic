import { expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  getSystemNavigation,
} from './e2e-helpers';

vi.mock('@tauri-apps/api/app', () => ({
  getTauriVersion: vi.fn<() => Promise<string>>().mockResolvedValue('2.11.2'),
  getVersion: vi.fn<() => Promise<string>>().mockResolvedValue('0.23.4'),
}));

beforeEachSetup({ width: 1440, height: 900, navigationMode: 'side' });

function openSettings(path: 'library' | 'audio' | 'ui' | 'about') {
  window.location.hash = `#/settings/${path}`;
}

test('Settings uses the MoeKoe-style category sidebar and setting card layout', async () => {
  openSettings('library');

  const settings = page.getByTestId('moekoe-settings');
  const settingsContent = page.getByTestId('settings-content');

  await expect.element(settings).toBeVisible();
  await expect
    .element(settings)
    .toHaveAttribute('data-reference-layout', 'moekoe-settings');
  await expect
    .element(page.getByRole('heading', { name: '音乐库', level: 2 }))
    .toBeVisible();

  const categoryNavigation = page.getByRole('navigation', {
    name: '设置分类',
  });
  await expect
    .element(categoryNavigation.getByRole('link', { name: '音乐库' }))
    .toHaveAttribute('data-status', 'active');
  await expect
    .element(categoryNavigation.getByRole('link', { name: '音频' }))
    .toBeVisible();
  await expect
    .element(categoryNavigation.getByRole('link', { name: '界面' }))
    .toBeVisible();
  await expect
    .element(categoryNavigation.getByRole('link', { name: '关于' }))
    .toBeVisible();

  expect(
    getComputedStyle(settingsContent.element() as HTMLElement).display,
  ).toBe('grid');
  expect(
    getComputedStyle(
      settingsContent
        .getByTestId('setting-card')
        .first()
        .element() as HTMLElement,
    ).borderRadius,
  ).toBe('12px');
});

test('Audio settings retain real controls as Chinese-labelled accessible switches', async () => {
  openSettings('library');

  const categoryNavigation = page.getByRole('navigation', {
    name: '设置分类',
  });
  await categoryNavigation.getByRole('link', { name: '音频' }).click();

  await expect
    .element(page.getByRole('heading', { name: '播放', level: 2 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('switch', { name: '跟随播放音轨' }))
    .toHaveAttribute('aria-checked', 'false');
  await expect
    .element(page.getByRole('switch', { name: '显示通知' }))
    .toHaveAttribute('aria-checked', 'false');
});

test('Interface and about keep their existing local settings and version data in the card hierarchy', async () => {
  openSettings('library');

  const categoryNavigation = page.getByRole('navigation', {
    name: '设置分类',
  });
  await categoryNavigation.getByRole('link', { name: '界面' }).click();

  await expect
    .element(page.getByRole('heading', { name: '界面', level: 2 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('combobox', { name: '主题' }))
    .toBeVisible();
  await expect
    .element(page.getByRole('switch', { name: '睡眠模式阻止器' }))
    .toHaveAttribute('aria-checked', 'false');

  await categoryNavigation.getByRole('link', { name: '关于' }).click();

  await expect
    .element(page.getByRole('heading', { name: '关于 YifuMusic', level: 2 }))
    .toBeVisible();
  await expect
    .element(page.getByRole('switch', { name: '自动检查更新' }))
    .toHaveAttribute('aria-checked', 'true');
  await expect
    .element(page.getByLabelText('版本信息'))
    .toHaveTextContent('V0.23.4 · Tauri 2.11.2');
  await expect
    .element(page.getByRole('region', { name: '构建身份' }))
    .toHaveTextContent(
      /构建身份版本0\.23\.4构建提交未知构建时间1970\/1\/1 \d{2}:00:00当前语言代码zh-CN构建渠道\/目标调试运行 \/ aarch64-apple-darwin/,
    );
});

test('界面设置保留桌面歌词真实入口，并清楚标记未接入服务', async () => {
  openSettings('ui');

  const { default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics');
  // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
  const openDesktopLyrics = vi.mocked(DesktopLyricsBridge.open);
  openDesktopLyrics.mockClear();

  const desktopLyrics = page.getByRole('button', { name: '打开桌面歌词' });
  await expect.element(desktopLyrics).toHaveAttribute('title', '桌面歌词');
  await desktopLyrics.click();
  expect(openDesktopLyrics).toHaveBeenCalledTimes(1);

  const unavailable = page.getByRole('button', {
    name: '在线服务、账号、代理、插件和 PWA 服务接入后可用',
  });
  await expect.element(unavailable).toBeDisabled();
  await expect.element(unavailable).toHaveAttribute('title', '服务接入后可用');
});

test('视觉开关即时控制玻璃、动效与发现页角色图，并持久化配置', async () => {
  openSettings('ui');

  const glass = page.getByRole('switch', { name: '液态玻璃效果' });
  const dynamic = page.getByRole('switch', { name: '动态效果' });
  const character = page.getByRole('switch', { name: '发现页角色图' });
  await expect.element(glass).toHaveAttribute('aria-checked', 'true');
  await expect.element(dynamic).toHaveAttribute('aria-checked', 'true');
  await expect.element(character).toHaveAttribute('aria-checked', 'true');

  const shell = page
    .getByTestId('app-shell-workspace')
    .element() as HTMLElement;
  const workspaceColumns = getComputedStyle(shell).gridTemplateColumns;
  const glassSurface = document.querySelector<HTMLElement>(
    '[data-glass-surface="card"]',
  );
  if (glassSurface === null) {
    throw new Error('未找到设置玻璃表面');
  }
  expect(getComputedStyle(glassSurface).backdropFilter).not.toBe('none');

  await glass.click();
  await expect.element(glass).toHaveAttribute('aria-checked', 'false');
  expect(getComputedStyle(glassSurface).backdropFilter).toBe('none');
  expect(getComputedStyle(shell).gridTemplateColumns).toBe(workspaceColumns);

  await dynamic.click();
  await expect.element(dynamic).toHaveAttribute('aria-checked', 'false');
  const routeTransition = document.querySelector<HTMLElement>(
    '[data-route-transition="enter"]',
  );
  if (routeTransition === null) {
    throw new Error('未找到页面过渡元素');
  }
  expect(getComputedStyle(routeTransition).animationName).toBe('none');
  expect(getComputedStyle(glassSurface).transitionDuration).toBe('0s');

  const configBridge = (await import('../lib/bridge-config')).default;
  expect(await configBridge.getAll()).toMatchObject({
    liquid_glass: false,
    dynamic_effects: false,
  });

  await character.click();
  await expect.element(character).toHaveAttribute('aria-checked', 'false');
  await getMainNavigation().getByRole('link', { name: '发现' }).click();
  await expect
    .element(page.getByTestId('discover-nangong-yu'))
    .not.toBeInTheDocument();

  await getSystemNavigation()
    .getByRole('link', { name: '设置', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('link', { name: '界面' })
    .click();
  await expect
    .element(page.getByRole('switch', { name: '液态玻璃效果' }))
    .toHaveAttribute('aria-checked', 'false');
  await expect
    .element(page.getByRole('switch', { name: '动态效果' }))
    .toHaveAttribute('aria-checked', 'false');
  const restoredCharacter = page.getByRole('switch', {
    name: '发现页角色图',
  });
  await restoredCharacter.click();
  await expect
    .element(restoredCharacter)
    .toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch', { name: '液态玻璃效果' }).click();
  await page.getByRole('switch', { name: '动态效果' }).click();
  await getMainNavigation().getByRole('link', { name: '发现' }).click();
  await expect.element(page.getByTestId('discover-nangong-yu')).toBeVisible();
});

test('设置布局在 1440、1024 与 700px 保持可读且分类可达', async () => {
  openSettings('library');

  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [700, 700],
  ] as const) {
    await page.viewport(width, height);
    window.dispatchEvent(new Event('resize'));

    const settings = page.getByTestId('moekoe-settings');
    const categoryNavigation = page.getByRole('navigation', {
      name: '设置分类',
    });
    await expect.element(settings).toBeVisible();
    await expect
      .element(categoryNavigation.getByRole('link', { name: '音乐库' }))
      .toBeInViewport();
    await expect
      .element(page.getByRole('button', { name: '扫描' }))
      .toBeInViewport();
  }
});

test('Interface settings switch between the persistent top and side navigation layouts', async () => {
  openSettings('library');

  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('link', { name: '界面' })
    .click();

  const navigationMode = page.getByRole('combobox', { name: '导航方式' });
  await expect.element(navigationMode).toHaveValue('side');

  const navigationModeElement = navigationMode.element() as HTMLSelectElement;
  navigationModeElement.value = 'top';
  navigationModeElement.dispatchEvent(new Event('change', { bubbles: true }));

  await expect
    .element(page.getByRole('combobox', { name: '导航方式' }))
    .toHaveValue('top');
  await expect
    .element(
      document.querySelector<HTMLElement>('[data-reference-layout="moekoe"]'),
    )
    .toHaveAttribute('data-navigation-mode', 'top');
  expect(window.localStorage.getItem('yifu-navigation-mode')).toBe('top');
});
