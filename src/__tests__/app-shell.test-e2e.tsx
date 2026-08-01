import { describe, expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import type { Track } from '../generated/typings';
import {
  beforeEachSetup,
  getMainNavigation,
  getSystemNavigation,
  getTrackList,
  setupScannedLibrary,
} from './e2e-helpers';

const LONG_TRACK_TITLE =
  'A deliberately long local track title that must remain inside the music library row at narrow widths';

const LONG_TITLE_TRACK: Track = {
  id: 'long-title-track',
  title: LONG_TRACK_TITLE,
  artists: ['YifuMusic test artist'],
  album: 'YifuMusic test album',
  duration: 180,
  album_artist: 'YifuMusic test artist',
  year: 2026,
  disk_no: 1,
  disk_of: 1,
  track_no: 1,
  track_of: 1,
  genres: ['test'],
  path: '/long-title-track.mp3',
  is_compilation: false,
};

function getWorkspaceColumns() {
  const workspace = page
    .getByTestId('app-shell-workspace')
    .element() as HTMLElement;

  return getComputedStyle(workspace)
    .gridTemplateColumns.split(' ')
    .filter(Boolean);
}

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

describe('wide app shell', () => {
  beforeEachSetup({
    width: 1440,
    height: 900,
    navigationMode: 'side',
  });

  test('uses the MoeKoe-style full side navigation, closed queue popup, and bottom player', async () => {
    expect(getWorkspaceColumns()).toHaveLength(2);
    expect(getWorkspaceColumns()[0]).toBe('226px');
    await expect.element(getMainNavigation()).toBeVisible();
    await expect
      .element(page.getByRole('complementary', { name: '播放队列' }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole('banner', { name: '播放器' }))
      .toBeVisible();

    const queueTrigger = page.getByRole('button', { name: /播放队列/ });
    await queueTrigger.click();

    const queue = page.getByRole('complementary', { name: '播放队列' });
    await expect.element(queue).toBeVisible();
    await expect
      .element(queue)
      .toHaveAttribute('data-reference-layout', 'moekoe-queue-popup');
  });

  test('closes the open queue popup after shrinking into the medium layout', async () => {
    await page.getByRole('button', { name: /播放队列/ }).click();
    await expect
      .element(page.getByRole('complementary', { name: '播放队列' }))
      .toBeVisible();

    await page.viewport(1024, 768);
    window.dispatchEvent(new Event('resize'));

    await expect
      .element(page.getByRole('dialog', { name: '播放队列', exact: true }))
      .not.toBeInTheDocument();
    expect(getWorkspaceColumns()).toHaveLength(2);
  });

  test('shows the reference-style offline status without replacing local controls', async () => {
    window.dispatchEvent(new Event('offline'));

    const status = page.getByTestId('connection-status');
    await expect.element(status).toHaveTextContent('网络连接已断开');
    await expect
      .element(status)
      .toHaveTextContent('本地音乐仍可使用；在线功能将在服务接入后可用。');
    await expect
      .element(status)
      .toHaveAttribute('data-reference-layout', 'moekoe-network-status');
    expect(getComputedStyle(status.element() as HTMLElement).left).toBe(
      '226px',
    );
    await expect
      .element(page.getByRole('banner', { name: '播放器' }))
      .toBeVisible();

    window.dispatchEvent(new Event('online'));
    await expect.element(status).not.toBeInTheDocument();
  });
});

describe('medium app shell', () => {
  beforeEachSetup({
    width: 1024,
    height: 768,
    navigationMode: 'side',
  });

  test('uses the reference-style toolbar to expand and restore the sidebar', async () => {
    const collapseButton = page.getByRole('button', { name: '收起侧边栏' });

    await collapseButton.click();
    expect(getWorkspaceColumns()[0]).toBe('67px');
    await expect
      .element(page.getByRole('button', { name: '展开侧边栏' }))
      .toBeInTheDocument();

    await page.getByRole('button', { name: '展开侧边栏' }).click();
    expect(getWorkspaceColumns()[0]).toBe('226px');
  });

  test('opens the queue temporarily, restores focus after Escape, and preserves the player', async () => {
    expect(getWorkspaceColumns()).toHaveLength(2);
    expect(getWorkspaceColumns()[0]).toBe('226px');

    const queuePanel = page.getByRole('dialog', {
      name: '播放队列',
      exact: true,
    });
    const queueTrigger = page.getByRole('button', { name: /播放队列/ });
    const player = page.getByRole('banner', { name: '播放器' });

    await expect.element(queuePanel).not.toBeInTheDocument();
    await expect.element(player).toBeVisible();

    await queueTrigger.click();
    await expect.element(queuePanel).toBeVisible();
    await expect.element(queuePanel).toHaveAttribute('aria-modal', 'true');

    const closeButton = page.getByRole('button', { name: '收起播放队列' });
    await expect.element(closeButton).toHaveFocus();

    await userEvent.keyboard('{Tab}');
    await expect.element(closeButton).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect.element(queuePanel).not.toBeInTheDocument();
    await expect.element(queueTrigger).toHaveFocus();

    await getSystemNavigation()
      .getByRole('link', { name: '设置', exact: true })
      .click();
    await expect.element(player).toBeVisible();
  });

  test('marks the current navigation item with a non-color active state', async () => {
    const navigation = getMainNavigation();
    const libraryLink = navigation.getByRole('link', { name: '音乐库' });

    await expect.element(libraryLink).toHaveAttribute('data-status', 'active');

    const settingsLink = getSystemNavigation().getByRole('link', {
      name: '设置',
      exact: true,
    });
    await settingsLink.click();

    await expect.element(settingsLink).toHaveAttribute('data-status', 'active');
  });

  test('keeps the offline status below the expanded side header at 1024px', async () => {
    window.dispatchEvent(new Event('offline'));

    const status = page.getByTestId('connection-status');
    await expect.element(status).toBeVisible();
    expect(getComputedStyle(status.element() as HTMLElement).top).toBe('52px');
    expect(getComputedStyle(status.element() as HTMLElement).left).toBe(
      '226px',
    );

    window.dispatchEvent(new Event('online'));
    await expect.element(status).not.toBeInTheDocument();
  });

  test('uses real router history and restores the main-content scroll position by full route', async () => {
    const mainContent = page
      .getByTestId('app-shell-main-content')
      .element() as HTMLElement;
    const back = page.getByRole('button', { name: '返回' });
    const forward = page.getByRole('button', { name: '前进' });

    mainContent.scrollTop = 148;
    mainContent.dispatchEvent(new Event('scroll'));

    await getSystemNavigation()
      .getByRole('link', { name: '设置', exact: true })
      .click();
    await expect
      .element(page.getByRole('heading', { name: '设置', level: 1 }))
      .toBeVisible();
    await expect.element(back).not.toBeDisabled();
    await expect.element(forward).toBeDisabled();

    await back.click();
    await expect
      .element(page.getByRole('heading', { name: '音乐库', level: 1 }))
      .toBeVisible();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    expect(mainContent.scrollTop).toBe(148);
    await expect.element(forward).not.toBeDisabled();

    await forward.click();
    await expect
      .element(page.getByRole('heading', { name: '设置', level: 1 }))
      .toBeVisible();

    const routeView = document.querySelector('[data-route-transition="enter"]');
    expect(routeView).not.toBeNull();
    expect(getComputedStyle(routeView as Element).animationName).toBe(
      'yifu-page-route-enter',
    );
  });
});

describe('narrow app shell', () => {
  beforeEachSetup({
    width: 700,
    height: 700,
    navigationMode: 'side',
  });

  test('uses the compact navigation rail and keeps core controls reachable', async () => {
    const columns = getWorkspaceColumns();

    expect(columns).toHaveLength(2);
    expect(columns[0]).toBe('64px');
    await expect
      .element(page.getByRole('button', { name: /播放队列/ }))
      .toBeInViewport();
    await expect
      .element(page.getByRole('button', { name: '播放', exact: true }))
      .toBeInViewport();
    await expect
      .element(page.getByRole('button', { name: '打开资料与服务菜单' }))
      .toBeInViewport();
  });

  test('truncates long local track titles without overflowing their row', async () => {
    const { default: DatabaseBridge } = await import('../lib/bridge-database');
    const getAllTracks = vi
      .spyOn(DatabaseBridge, 'getAllTracks')
      .mockResolvedValue([LONG_TITLE_TRACK]);

    try {
      await setupScannedLibrary();

      const title = getTrackList().getByTitle(LONG_TRACK_TITLE);
      await expect.element(title).toBeVisible();

      const titleElement = title.element() as HTMLElement;
      const rowElement = titleElement.closest('[role="option"]');
      const titleStyles = getComputedStyle(titleElement);

      expect(rowElement).not.toBeNull();
      expect(titleStyles.overflow).toBe('hidden');
      expect(titleStyles.textOverflow).toBe('ellipsis');
      expect(titleStyles.whiteSpace).toBe('nowrap');
      expect(titleElement.scrollWidth).toBeGreaterThan(
        titleElement.clientWidth,
      );
      expect(titleElement.getBoundingClientRect().right).toBeLessThanOrEqual(
        rowElement?.getBoundingClientRect().right ?? 0,
      );
    } finally {
      getAllTracks.mockRestore();
    }
  });

  test('keeps MoeKoe-style search entries reachable from settings and track details', async () => {
    window.location.hash = '#/settings';
    await expect
      .element(page.getByRole('heading', { name: '设置', level: 1 }))
      .toBeInTheDocument();

    const settingsHeader = getPageHeader('设置');
    const compactSearch = settingsHeader.getByRole('button', {
      name: '打开搜索',
    });
    await expect.element(compactSearch).toBeVisible();
    await compactSearch.click();
    await expect
      .element(compactSearch)
      .toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(settingsHeader.getByRole('textbox', { name: '搜索音乐库' }))
      .toHaveFocus();
    expect(
      compactSearch
        .element()
        .parentElement?.getAttribute('data-reference-layout'),
    ).toBe('moekoe-top-search');

    const sidebarSearch = page.getByRole('link', { name: '搜索', exact: true });
    await expect.element(sidebarSearch).toBeVisible();
    await sidebarSearch.click();
    await expect
      .element(page.getByRole('heading', { name: '搜索结果', level: 2 }))
      .toBeInTheDocument();

    await setupScannedLibrary();
    window.location.hash = '#/tracks/0';
    await expect
      .element(page.getByRole('heading', { name: '音轨详情', level: 1 }))
      .toBeInTheDocument();
    await expect
      .element(
        getPageHeader('音轨详情').getByRole('button', { name: '打开搜索' }),
      )
      .toBeVisible();
  });

  test('uses the compact rail offset for the offline status at 700px', async () => {
    window.dispatchEvent(new Event('offline'));

    const status = page.getByTestId('connection-status');
    await expect.element(status).toBeVisible();
    expect(getComputedStyle(status.element() as HTMLElement).left).toBe('64px');
    await expect
      .element(page.getByRole('button', { name: '播放', exact: true }))
      .toBeInViewport();

    window.dispatchEvent(new Event('online'));
    await expect.element(status).not.toBeInTheDocument();
  });
});

describe('default top app shell', () => {
  beforeEachSetup({ width: 1440, height: 900, navigationMode: null });

  test('uses the MoeKoe top navigation and a fixed player dock by default', async () => {
    const player = page.getByRole('banner', { name: '播放器' });

    await expect
      .element(page.getByRole('navigation', { name: '主导航' }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole('navigation', { name: '顶部导航' }))
      .toBeVisible();
    expect(getComputedStyle(player.element() as HTMLElement).position).toBe(
      'fixed',
    );
  });
});

describe('profile service menu and disclaimer', () => {
  beforeEachSetup({ width: 1024, height: 768, navigationMode: 'side' });

  test('keeps unavailable services honest and restores focus after closing the disclaimer', async () => {
    const trigger = page.getByRole('button', { name: '打开资料与服务菜单' });
    const player = page.getByRole('banner', { name: '播放器' });

    await trigger.click();
    const menu = page.getByRole('menu', { name: '资料与服务菜单' });
    await expect.element(menu).toBeVisible();

    for (const label of [
      '登录（服务接入后可用）',
      'VIP（服务接入后可用）',
      '我的云盘（服务接入后可用）',
      '在线收藏（服务接入后可用）',
      '检查更新（服务接入后可用）',
    ]) {
      const unavailableItem = menu.getByRole('menuitem', { name: label });
      await expect.element(unavailableItem).toBeDisabled();
      await expect.element(unavailableItem).toHaveAttribute('title', label);
    }

    await menu.getByRole('menuitem', { name: '免责声明' }).click();
    const disclaimer = page.getByRole('dialog', { name: '免责声明' });
    await expect.element(disclaimer).toBeVisible();
    await expect
      .element(disclaimer)
      .toHaveTextContent('本地音乐库、播放队列和本地歌词');
    await expect
      .element(disclaimer.getByRole('button', { name: '关闭免责声明' }))
      .toHaveFocus();
    await expect.element(player).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(disclaimer).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();

    await trigger.click();
    await expect.element(menu).toBeVisible();
    await page.getByTestId('app-shell-main-content').click();
    await expect.element(menu).not.toBeInTheDocument();
  });
});

describe('motion preferences', () => {
  beforeEachSetup({ width: 1024, height: 768 });

  test('loads the reduced-motion rule for shell transitions', () => {
    const reducedMotionRules = Array.from(document.styleSheets)
      .flatMap((stylesheet) => Array.from(stylesheet.cssRules))
      .filter(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === '(prefers-reduced-motion: reduce)',
      )
      .map((rule) => rule.cssText)
      .join('\n');

    expect(reducedMotionRules).toContain('transition-duration: 0.01ms');
    expect(reducedMotionRules).toContain('animation-duration: 0.01ms');
  });
});
