import { describe, expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import type { Track } from '../generated/typings';
import {
  beforeEachSetup,
  getMainNavigation,
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

describe('wide app shell', () => {
  beforeEachSetup({ width: 1440, height: 900 });

  test('keeps the navigation, content, queue, and bottom player in view', async () => {
    expect(getWorkspaceColumns()).toHaveLength(3);
    await expect.element(getMainNavigation()).toBeVisible();
    await expect
      .element(page.getByRole('complementary', { name: 'Queue' }))
      .toBeVisible();
    await expect
      .element(page.getByRole('banner', { name: 'Player' }))
      .toBeVisible();
  });

  test('closes the persistent queue after shrinking into the medium layout', async () => {
    await expect
      .element(page.getByRole('complementary', { name: 'Queue' }))
      .toBeVisible();

    await page.viewport(1024, 768);
    window.dispatchEvent(new Event('resize'));

    await expect
      .element(page.getByRole('dialog', { name: 'Queue', exact: true }))
      .not.toBeInTheDocument();
    expect(getWorkspaceColumns()).toHaveLength(2);
  });
});

describe('medium app shell', () => {
  beforeEachSetup({ width: 1024, height: 768 });

  test('opens the queue temporarily, restores focus after Escape, and preserves the player', async () => {
    expect(getWorkspaceColumns()).toHaveLength(2);

    const queuePanel = page.getByRole('dialog', {
      name: 'Queue',
      exact: true,
    });
    const queueTrigger = page.getByRole('button', { name: /Queue/ });
    const player = page.getByRole('banner', { name: 'Player' });

    await expect.element(queuePanel).not.toBeInTheDocument();
    await expect.element(player).toBeVisible();

    await queueTrigger.click();
    await expect.element(queuePanel).toBeVisible();
    await expect.element(queuePanel).toHaveAttribute('aria-modal', 'true');

    const closeButton = page.getByRole('button', { name: 'Collapse queue' });
    await expect.element(closeButton).toHaveFocus();

    await userEvent.keyboard('{Tab}');
    await expect.element(closeButton).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect.element(queuePanel).not.toBeInTheDocument();
    await expect.element(queueTrigger).toHaveFocus();

    await getMainNavigation().getByRole('link', { name: 'Settings' }).click();
    await expect.element(player).toBeVisible();
  });

  test('marks the current navigation item with a non-color active state', async () => {
    const navigation = getMainNavigation();
    const libraryLink = navigation.getByRole('link', { name: 'Library' });

    await expect.element(libraryLink).toHaveAttribute('data-status', 'active');

    const settingsLink = navigation.getByRole('link', { name: 'Settings' });
    await settingsLink.click();

    await expect.element(settingsLink).toHaveAttribute('data-status', 'active');
  });
});

describe('narrow app shell', () => {
  beforeEachSetup({ width: 800, height: 700 });

  test('uses the compact navigation rail and keeps core controls reachable', async () => {
    const columns = getWorkspaceColumns();

    expect(columns).toHaveLength(2);
    expect(columns[0]).toBe('64px');
    await expect
      .element(page.getByRole('button', { name: /Queue/ }))
      .toBeInViewport();
    await expect
      .element(page.getByRole('button', { name: /Play/ }))
      .toBeInViewport();
  });

  test('truncates long local track titles without overflowing their row', async () => {
    const { default: DatabaseBridge } = await import('../lib/bridge-database');
    const getAllTracks = vi
      .spyOn(DatabaseBridge, 'getAllTracks')
      .mockResolvedValue([LONG_TITLE_TRACK]);

    try {
      await setupScannedLibrary();

      const title = page.getByTitle(LONG_TRACK_TITLE);
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
