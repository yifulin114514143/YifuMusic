import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import type { LyricsReadResult } from '../lib/bridge-lyrics';
import {
  beforeEachSetup,
  getSystemNavigation,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

function getOpenNowPlayingButton() {
  return page.getByTestId('open-now-playing-button');
}

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

test('opens the now playing overlay without replacing the player audio element', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const player = (await import('../lib/player')).default;
  const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
  const openButton = getOpenNowPlayingButton();

  await openButton.click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  await expect.element(overlay).toBeVisible();
  expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(audio);

  await userEvent.keyboard('{Escape}');

  await expect.element(overlay).not.toBeInTheDocument();
  await expect.element(openButton).toHaveFocus();
});

test('opens the MoeKoe-style vinyl view with its queue closed on wide screens', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  await getOpenNowPlayingButton().click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  const vinyl = overlay.getByTestId('now-playing-vinyl');

  await expect.element(vinyl).toBeVisible();
  await expect.element(vinyl).toHaveAttribute('data-playback-state', 'playing');
  await expect
    .element(page.getByRole('complementary', { name: '播放队列' }))
    .not.toBeInTheDocument();

  await overlay.getByRole('button', { name: '打开播放队列' }).click();
  await expect
    .element(page.getByRole('complementary', { name: '播放队列' }))
    .toBeVisible();
});

test('switches the MoeKoe-style artwork between vinyl and cover modes', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  await getOpenNowPlayingButton().click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  const artwork = overlay.getByTestId('now-playing-artwork');

  await expect.element(overlay.getByTestId('now-playing-vinyl')).toBeVisible();
  await artwork.click();
  await expect.element(overlay.getByTestId('now-playing-cover')).toBeVisible();
  await expect
    .element(overlay.getByTestId('now-playing-vinyl'))
    .not.toBeInTheDocument();

  await artwork.click();
  await expect.element(overlay.getByTestId('now-playing-vinyl')).toBeVisible();
});

test('opens desktop lyrics without replacing the player audio element', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const player = (await import('../lib/player')).default;
  const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
  const { default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics');
  // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
  const openDesktopLyrics = vi.mocked(DesktopLyricsBridge.open);
  openDesktopLyrics.mockClear();

  await page.getByTestId('open-desktop-lyrics-button').click();

  expect(openDesktopLyrics).toHaveBeenCalledTimes(1);
  expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(audio);
});

test('切换 macOS 状态栏歌词后立即重新同步托盘状态', async () => {
  if (window.__MUSEEKS_PLATFORM !== 'macos') return;

  await setupScannedLibrary();
  const player = (await import('../lib/player')).default;
  player.stop();
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const { default: TrayBridge } = await import('../lib/bridge-tray');
  const syncTrayState = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    TrayBridge.syncState,
  );
  const { default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics');
  const syncDesktopLyricsState = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    DesktopLyricsBridge.syncState,
  );

  getSiblingLyrics.mockResolvedValue({
    status: 'available',
    source: 'sibling-file',
    text: '[00:00.000]当前状态栏歌词',
  });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();
    await expect
      .element(page.getByText('当前状态栏歌词', { exact: true }))
      .toBeVisible();
    await page.getByRole('button', { name: '关闭正在播放页' }).click();

    const trackID = player.getTrack()?.id;
    expect(trackID).toBeDefined();

    await vi.waitFor(() => {
      expect(syncDesktopLyricsState).toHaveBeenLastCalledWith(
        expect.objectContaining({
          trackId: trackID,
          lyrics: [{ timeMs: 0, text: '当前状态栏歌词' }],
          lyricsKind: 'timed',
        }),
      );
    });
    syncTrayState.mockClear();
    await getSystemNavigation()
      .getByRole('link', { name: '设置', exact: true })
      .click();
    await page.getByRole('link', { name: '界面' }).click();

    const statusBarLyrics = page.getByRole('switch', {
      name: '状态栏歌词',
    });
    await statusBarLyrics.click();
    await expect.element(statusBarLyrics).toBeChecked();
    await vi.waitFor(() => {
      expect(syncTrayState).toHaveBeenCalledTimes(1);
    });

    expect(syncTrayState).toHaveBeenLastCalledWith({
      trackId: trackID,
      title: 'Whiskey Blues',
      artists: ['Captain_Sleepy'],
      isPaused: false,
      currentLyric: '当前状态栏歌词',
    });

    syncTrayState.mockClear();
    await statusBarLyrics.click();
    await expect.element(statusBarLyrics).not.toBeChecked();
    await vi.waitFor(() => {
      expect(syncTrayState).toHaveBeenCalledTimes(1);
    });

    expect(syncTrayState).toHaveBeenLastCalledWith({
      trackId: trackID,
      title: 'Whiskey Blues',
      artists: ['Captain_Sleepy'],
      isPaused: false,
      currentLyric: '当前状态栏歌词',
    });
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  }
});

test('keeps bottom playback controls from opening the now playing overlay', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const playerHeader = page.getByRole('banner', { name: '播放器' });

  await playerHeader.getByRole('button', { name: '播放速度：1 倍' }).click();
  await playerHeader.getByRole('menuitemradio', { name: '1.25x' }).click();
  await playerHeader
    .getByRole('button', { name: '收藏歌曲（暂未实现）' })
    .click();
  await playerHeader.getByRole('button', { name: '加入歌单' }).click();
  await playerHeader.getByRole('button', { name: '加入歌单' }).click();
  await playerHeader
    .getByRole('button', { name: '分享歌曲（暂未实现）' })
    .click();
  await playerHeader.getByRole('button', { name: /播放模式：/ }).click();
  await playerHeader.getByRole('button', { name: '静音' }).click();
  await playerHeader.getByRole('button', { name: /播放队列/ }).click();
  await playerHeader.getByRole('button', { name: '上一首' }).click();
  await playerHeader.getByRole('button', { name: '下一首' }).click();

  await expect
    .element(page.getByRole('dialog', { name: '正在播放' }))
    .not.toBeInTheDocument();
});

test('reads local timed lyrics, follows the real player time, and restores follow mode', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  getSiblingLyrics.mockResolvedValue({
    status: 'available',
    source: 'sibling-file',
    text: [
      '[00:00.000]First lyric',
      '[00:04.000]Second lyric',
      ...Array.from(
        { length: 30 },
        (_, index) =>
          `[${String(index + 5).padStart(2, '0')}:00.000]Later lyric ${index}`,
      ),
    ].join('\n'),
  });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    const firstLine = overlay.getByText('First lyric');
    await expect.element(firstLine).toHaveAttribute('aria-current', 'true');

    const player = (await import('../lib/player')).default;
    const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
    audio.currentTime = 4;
    audio.dispatchEvent(new Event('timeupdate'));

    await expect
      .element(overlay.getByText('Second lyric'))
      .toHaveAttribute('aria-current', 'true');

    await overlay.getByRole('button', { name: 'First lyric' }).click();
    expect(audio.currentTime).toBeLessThan(0.1);

    const lyricsScroller = page
      .getByTestId('lyrics-scroll-region')
      .element() as HTMLDivElement;
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    lyricsScroller.scrollTop = 120;
    lyricsScroller.dispatchEvent(new Event('scroll', { bubbles: true }));

    const returnButton = overlay.getByRole('button', {
      name: '回到当前歌词',
    });
    await expect.element(returnButton).toBeVisible();
    await returnButton.click();
    await expect.element(returnButton).not.toBeInTheDocument();
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  }
});

test('persists MoeKoe-style lyrics display preferences without claiming character timing support', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  getSiblingLyrics.mockResolvedValue({
    status: 'available',
    source: 'sibling-file',
    text: '[00:00.000]First lyric\n[00:04.000]Second lyric',
  });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    const settingsButton = overlay.getByRole('button', {
      name: '歌词显示设置',
    });
    await settingsButton.click();

    const settings = page.getByTestId('fullscreen-lyrics-settings');
    await expect.element(settings).toBeVisible();
    await expect
      .element(settings.getByRole('button', { name: '背景：开启' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(
        settings.getByRole('button', {
          name: '高亮方式：逐行',
        }),
      )
      .toBeDisabled();
    await expect
      .element(
        settings.getByRole('button', {
          name: '当前本地歌词只提供逐行时间，逐字高亮不可用',
        }),
      )
      .toBeDisabled();

    await settings.getByRole('button', { name: '背景：封面' }).click();
    await settings.getByRole('button', { name: '字体大小：大' }).click();
    await settings.getByRole('button', { name: '对齐方式：居左' }).click();
    await settings.getByRole('button', { name: '显示方式：单行' }).click();

    await expect
      .element(overlay)
      .toHaveAttribute('data-lyrics-background', 'cover');
    await expect
      .element(overlay)
      .toHaveAttribute('data-lyrics-display-mode', 'single');
    const currentLine = overlay.getByRole('button', { name: 'First lyric' });
    await expect.element(currentLine).toBeVisible();
    expect(
      getComputedStyle(currentLine.element() as HTMLElement).fontSize,
    ).toBe('32px');
    expect(
      getComputedStyle(currentLine.element() as HTMLElement).textAlign,
    ).toBe('left');
    await expect
      .element(overlay.getByText('Second lyric'))
      .not.toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem('fullscreen-lyrics-settings') ?? '{}',
      ),
    ).toEqual({
      background: 'cover',
      fontSize: '32px',
      align: 'left',
      displayMode: 'single',
    });

    await userEvent.keyboard('{Escape}');
    await expect.element(settings).not.toBeInTheDocument();
    await expect.element(settingsButton).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    await expect.element(overlay).not.toBeInTheDocument();

    await getOpenNowPlayingButton().click();
    const reopenedOverlay = page.getByRole('dialog', { name: '正在播放' });
    await expect
      .element(reopenedOverlay)
      .toHaveAttribute('data-lyrics-background', 'cover');
    await expect
      .element(reopenedOverlay)
      .toHaveAttribute('data-lyrics-display-mode', 'single');
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  }
});

test('keeps plain local lyrics readable and disables unavailable single-line mode', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  getSiblingLyrics.mockResolvedValue({
    status: 'available',
    source: 'sibling-file',
    text: 'First plain lyric\nSecond plain lyric',
  });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await overlay.getByRole('button', { name: '歌词显示设置' }).click();

    const settings = page.getByTestId('fullscreen-lyrics-settings');
    await expect
      .element(
        settings.getByRole('button', {
          name: '纯文本歌词无法定位当前行，单行模式不可用',
        }),
      )
      .toBeDisabled();
    await expect
      .element(overlay)
      .toHaveAttribute('data-lyrics-display-mode', 'scroll');
    await expect.element(overlay.getByText('First plain lyric')).toBeVisible();
    await expect.element(overlay.getByText('Second plain lyric')).toBeVisible();
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  }
});

test('keeps the lyrics settings panel inside the medium and narrow now-playing overlay', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  await getOpenNowPlayingButton().click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  const settingsButton = overlay.getByRole('button', {
    name: '歌词显示设置',
  });

  for (const [width, height] of [
    [1024, 768],
    [700, 700],
  ] as const) {
    await page.viewport(width, height);
    window.dispatchEvent(new Event('resize'));
    await settingsButton.click();

    const settings = page.getByTestId('fullscreen-lyrics-settings');
    await expect.element(settings).toBeVisible();

    await expect.element(settingsButton).toBeInViewport();
    const overlayBounds = overlay.element().getBoundingClientRect();
    const settingsBounds = settings.element().getBoundingClientRect();
    expect(settingsBounds.left).toBeGreaterThanOrEqual(overlayBounds.left);
    expect(settingsBounds.right).toBeLessThanOrEqual(overlayBounds.right);
  }
});

test('keeps the lyrics settings and local queue drawer mutually exclusive at medium and narrow widths', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  await getOpenNowPlayingButton().click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  const settingsButton = overlay.getByRole('button', {
    name: '歌词显示设置',
  });
  const queueButton = overlay.getByRole('button', { name: '打开播放队列' });

  for (const [width, height] of [
    [1024, 768],
    [700, 700],
  ] as const) {
    await page.viewport(width, height);
    window.dispatchEvent(new Event('resize'));

    await settingsButton.click();
    await expect
      .element(page.getByTestId('fullscreen-lyrics-settings'))
      .toBeVisible();

    await queueButton.click();
    await expect
      .element(page.getByTestId('fullscreen-lyrics-settings'))
      .not.toBeInTheDocument();
    const drawer = page.getByRole('dialog', { name: '播放队列', exact: true });
    await expect.element(drawer).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(drawer).not.toBeInTheDocument();
  }
});

test('keeps playback unchanged when lyrics are unavailable, unreadable, or malformed', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const player = (await import('../lib/player')).default;

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();

    const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
    const trackID = player.getTrack()?.id;
    const { isPaused, queueCursor } = player.getState();
    expect(trackID).toBeDefined();

    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
    await getOpenNowPlayingButton().click();
    let overlay = page.getByRole('dialog', { name: '正在播放' });
    await expect.element(overlay.getByText('暂无歌词')).toBeVisible();
    expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(
      audio,
    );
    expect(player.getTrack()?.id).toBe(trackID);
    expect(player.getState()).toMatchObject({ isPaused, queueCursor });
    await overlay.getByRole('button', { name: '关闭正在播放页' }).click();
    await expect.element(overlay).not.toBeInTheDocument();

    getSiblingLyrics.mockResolvedValue({ status: 'failed' });
    await getOpenNowPlayingButton().click();
    overlay = page.getByRole('dialog', { name: '正在播放' });
    await expect.element(overlay.getByText('无法读取歌词')).toBeVisible();
    expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(
      audio,
    );
    expect(player.getTrack()?.id).toBe(trackID);
    expect(player.getState()).toMatchObject({ isPaused, queueCursor });
    await overlay.getByRole('button', { name: '关闭正在播放页' }).click();
    await expect.element(overlay).not.toBeInTheDocument();

    getSiblingLyrics.mockResolvedValue({
      status: 'available',
      source: 'sibling-file',
      text: '[00:75]Malformed lyric timestamp',
    });
    await getOpenNowPlayingButton().click();
    overlay = page.getByRole('dialog', { name: '正在播放' });
    await expect.element(overlay.getByText('无法解析歌词')).toBeVisible();
    expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(
      audio,
    );
    expect(player.getTrack()?.id).toBe(trackID);
    expect(player.getState()).toMatchObject({ isPaused, queueCursor });
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  }
});

test('keeps a user-selected lyrics file when the sibling lookup finishes later', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  const siblingLyrics = createDeferred<LyricsReadResult>();
  const selectedLyrics = createDeferred<LyricsReadResult>();
  getSiblingLyrics.mockImplementation(() => siblingLyrics.promise);
  selectAndRead.mockImplementation(() => selectedLyrics.promise);

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await expect.element(overlay.getByText('正在加载歌词...')).toBeVisible();
    await overlay.getByRole('button', { name: '选择歌词文件' }).click();

    selectedLyrics.resolve({
      status: 'available',
      source: 'user-file',
      text: 'Selected lyrics',
    });
    await expect.element(overlay.getByText('Selected lyrics')).toBeVisible();

    siblingLyrics.resolve({
      status: 'available',
      source: 'sibling-file',
      text: 'Sibling lyrics',
    });
    await expect.element(overlay.getByText('Selected lyrics')).toBeVisible();
    await expect
      .element(overlay.getByText('Sibling lyrics'))
      .not.toBeInTheDocument();
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('keeps the overlay responsive while a manual lyrics selection is pending', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  const selectedLyrics = createDeferred<LyricsReadResult>();
  selectAndRead.mockClear();
  selectAndRead.mockImplementation(() => selectedLyrics.promise);

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    const chooseLyricsButton = overlay.getByRole('button', {
      name: '选择歌词文件',
    });
    await chooseLyricsButton.click();

    expect(selectAndRead).toHaveBeenCalledTimes(1);
    await expect.element(chooseLyricsButton).toBeDisabled();
    await overlay.getByRole('button', { name: '关闭正在播放' }).click();
    await expect.element(overlay).not.toBeInTheDocument();

    selectedLyrics.resolve({ status: 'cancelled' });
  } finally {
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('keeps existing lyrics and reports no error when manual selection is cancelled', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  getSiblingLyrics.mockResolvedValue({
    status: 'available',
    source: 'sibling-file',
    text: 'Existing lyrics',
  });
  selectAndRead.mockResolvedValue({ status: 'cancelled' });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await expect.element(overlay.getByText('Existing lyrics')).toBeVisible();
    await overlay.getByRole('button', { name: '选择歌词文件' }).click();

    await expect.element(overlay.getByText('Existing lyrics')).toBeVisible();
    await expect
      .element(overlay.getByText('无法读取歌词'))
      .not.toBeInTheDocument();
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('shows a lyrics read failure without interrupting the playing track', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  const player = (await import('../lib/player')).default;
  getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  selectAndRead.mockResolvedValue({ status: 'failed' });

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    const trackID = player.getTrack()?.id;
    const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await overlay.getByRole('button', { name: '选择歌词文件' }).click();

    await expect.element(overlay.getByText('无法读取歌词')).toBeVisible();
    expect((player as unknown as { audio: HTMLAudioElement }).audio).toBe(
      audio,
    );
    expect(player.getTrack()?.id).toBe(trackID);
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('does not apply selected lyrics after playback changes tracks', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  const selectedLyrics = createDeferred<LyricsReadResult>();
  selectAndRead.mockImplementation(() => selectedLyrics.promise);
  const player = (await import('../lib/player')).default;

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    const originalTrackID = player.getTrack()?.id;
    await getOpenNowPlayingButton().click();

    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await overlay.getByRole('button', { name: '选择歌词文件' }).click();
    await overlay.getByRole('button', { name: '下一首' }).click();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    expect(player.getTrack()?.id).not.toBe(originalTrackID);

    selectedLyrics.resolve({
      status: 'available',
      source: 'user-file',
      text: 'Lyrics for the previous track',
    });
    await expect.element(overlay.getByText('暂无歌词')).toBeVisible();
    await expect
      .element(overlay.getByText('Lyrics for the previous track'))
      .not.toBeInTheDocument();
  } finally {
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('shares user-selected lyrics with desktop lyrics without leaking them to the next track', async () => {
  await setupScannedLibrary();
  const { default: LyricsBridge } = await import('../lib/bridge-lyrics');
  const getSiblingLyrics = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.getSiblingLyrics,
  );
  const selectAndRead = vi.mocked(
    // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
    LyricsBridge.selectAndRead,
  );
  const { default: DesktopLyricsBridge } =
    await import('../lib/bridge-desktop-lyrics');
  // oxlint-disable-next-line typescript/unbound-method -- Vitest exposes this mocked bridge method.
  const syncState = vi.mocked(DesktopLyricsBridge.syncState);
  const selectedLyrics = createDeferred<LyricsReadResult>();
  const player = (await import('../lib/player')).default;
  getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
  selectAndRead.mockImplementation(() => selectedLyrics.promise);
  syncState.mockClear();

  try {
    await getTrackByName(/Whiskey Blues/).dblClick();
    const firstTrackID = player.getTrack()?.id;
    expect(firstTrackID).toBeDefined();

    await getOpenNowPlayingButton().click();
    const overlay = page.getByRole('dialog', { name: '正在播放' });
    await overlay.getByRole('button', { name: '选择歌词文件' }).click();

    selectedLyrics.resolve({
      status: 'available',
      source: 'user-file',
      text: '[00:00.000]手选歌词',
    });
    await expect.element(overlay.getByText('手选歌词')).toBeVisible();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    expect(syncState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trackId: firstTrackID,
        lyricsKind: 'timed',
        lyrics: [{ timeMs: 0, text: '手选歌词' }],
      }),
    );

    await overlay.getByRole('button', { name: '下一首' }).click();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
    const secondTrackID = player.getTrack()?.id;
    expect(secondTrackID).toBeDefined();
    expect(secondTrackID).not.toBe(firstTrackID);
    expect(
      syncState.mock.calls.some(
        ([payload]) =>
          payload.trackId === secondTrackID &&
          payload.lyrics.some((line) => line.text === '手选歌词'),
      ),
    ).toBe(false);
  } finally {
    getSiblingLyrics.mockResolvedValue({ status: 'unavailable' });
    selectAndRead.mockResolvedValue({ status: 'cancelled' });
  }
});

test('uses a local queue drawer at medium widths without changing the app queue state', async () => {
  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();
  await getOpenNowPlayingButton().click();

  const overlay = page.getByRole('dialog', { name: '正在播放' });
  const queueButton = overlay.getByRole('button', { name: '打开播放队列' });
  await queueButton.click();

  const drawer = page.getByRole('dialog', { name: '播放队列', exact: true });
  await expect.element(drawer).toBeVisible();
  await expect.element(drawer).toHaveAttribute('aria-modal', 'true');

  const closeButton = drawer.getByRole('button', { name: '关闭播放队列' });
  await expect.element(closeButton).toHaveFocus();
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  expect(drawer.element().contains(document.activeElement)).toBe(true);

  await userEvent.keyboard('{Escape}');
  await expect.element(drawer).not.toBeInTheDocument();
  await expect.element(overlay).toBeVisible();
  await expect.element(queueButton).toHaveFocus();
});
