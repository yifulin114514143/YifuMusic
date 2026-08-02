import { expect, test } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getSortButton,
  getTrackAt,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup({ width: 1440, height: 900 });

function getGridColumnCount(element: HTMLElement) {
  return getComputedStyle(element).gridTemplateColumns.split(' ').length;
}

function getPageHeader() {
  const title = page
    .getByRole('heading', { name: '音乐库', level: 1 })
    .element();
  const header = title.closest('header');

  if (header === null) {
    throw new Error('音乐库页面标题未包含在顶栏中');
  }

  return page.elementLocator(header);
}

function getPageHeaderSearch() {
  return getPageHeader().getByRole('textbox', { name: '搜索音乐库' });
}

function getPageHeaderSearchClear() {
  return getPageHeader().getByTitle('清除搜索');
}

test('The library tab should display all tracks', async () => {
  await setupScannedLibrary();

  // Ensure we have the 3 test-tracks, but no more
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();
  await expect.element(getTrackAt(3)).not.toBeInTheDocument();

  await expect.element(getTrackAt(0)).toHaveAttribute('aria-selected', 'false');
  await expect.element(getTrackAt(1)).toHaveAttribute('aria-selected', 'false');
  await expect.element(getTrackAt(2)).toHaveAttribute('aria-selected', 'false');
});

test('Library overview shows verified local data and labels online features as unavailable', async () => {
  await setupScannedLibrary();

  const overview = page.getByTestId('library-local-overview');
  await expect
    .element(overview)
    .toHaveAttribute('data-reference-layout', 'moekoe-library');
  await expect.element(overview).toHaveTextContent('3 首音轨 / 15:00');
  await expect
    .element(page.getByTestId('library-track-count'))
    .toHaveTextContent('3');
  await expect
    .element(page.getByTestId('library-duration'))
    .toHaveTextContent('15:00');
  await expect
    .element(page.getByTestId('library-playlist-count'))
    .toHaveTextContent('0');

  const unavailable = page.getByTestId('library-service-unavailable');
  await expect.element(unavailable).toHaveTextContent('服务接入后可用');
  await expect
    .element(unavailable)
    .toHaveTextContent(
      '在线账号、VIP 与听歌历史将在服务契约验证并接入后显示。',
    );
  await expect
    .element(page.getByRole('link', { name: '创建歌单' }))
    .toBeInTheDocument();
});

test('Library account actions preserve the reference hierarchy without fake online data', async () => {
  await setupScannedLibrary();

  const account = page.getByTestId('library-account-actions');
  await expect.element(account).toHaveTextContent('资料 / 账户');
  await expect
    .element(account.getByRole('link', { name: '打开我的本地歌单' }))
    .toBeInTheDocument();
  await expect
    .element(account.getByRole('link', { name: '打开本地音乐' }))
    .toBeInTheDocument();

  for (const label of [
    '听歌历史',
    '签到',
    'VIP',
    '收藏歌单',
    '收藏专辑',
    '关注歌手',
    '好友',
    '我的云盘',
  ]) {
    const action = account.getByRole('button', {
      name: `${label}，服务接入后可用`,
    });
    await expect.element(action).toBeDisabled();
    await expect.element(action).toHaveAttribute('aria-disabled', 'true');
    await expect
      .element(action)
      .toHaveAttribute('title', `${label}：服务接入后可用`);
  }
});

test('音乐库在 1440px、1024px、700px 下保持资料入口可达', async () => {
  await setupScannedLibrary();

  const grid = page
    .getByTestId('library-account-grid')
    .element() as HTMLElement;
  expect(getGridColumnCount(grid)).toBe(5);

  await page.viewport(1024, 768);
  window.dispatchEvent(new Event('resize'));
  expect(getGridColumnCount(grid)).toBe(3);
  await expect
    .element(page.getByRole('button', { name: '我的云盘，服务接入后可用' }))
    .toBeInTheDocument();

  await page.viewport(700, 700);
  window.dispatchEvent(new Event('resize'));
  expect(getGridColumnCount(grid)).toBe(2);
  await expect
    .element(page.getByRole('link', { name: '打开本地音乐' }))
    .toBeInTheDocument();
});

test('Tracks should selectable via click + modifiers', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  // Click on a track should select it
  await secondTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  await thirdTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Cmd/Ctrl + click on a selected track should deselect it
  await userEvent.click(firstTrack, {
    modifiers: ['ControlOrMeta'],
    button: 'left',
  });
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Clicking a single track should select this one and deselect all others
  await firstTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  // Clicking on a track with Shift should select all tracks in between
  await thirdTrack.click({ modifiers: ['Shift'] });
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');
});

test('Tracks should be selectable via keyboard only (after a single selection)', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  await expect.element(firstTrack).toHaveTextContent('Whiskey Blues');
  await expect.element(secondTrack).toHaveTextContent('Majestic Blues');
  await expect.element(thirdTrack).toHaveTextContent('Romantic Blues');

  await firstTrack.click();
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  // Cmd+A should select all tracks
  // await userEvent.keyboard('{ControlOrMeta>}A{/ControlOrMeta}'); // not working, select the text instead :(
  // await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  // await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  // await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Use single arrow-up/down to select the previous/next track
  await userEvent.keyboard('[ArrowDown]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');

  await userEvent.keyboard('[ArrowUp]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');

  await userEvent.keyboard('[ArrowDown],[ArrowDown]');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Use Shift+ArrowUp/Down to select multiple tracks
  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'false');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');

  // Shift+Arrow should go both ways
  await secondTrack.click();
  await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'false');

  await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
  await expect.element(firstTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(secondTrack).toHaveAttribute('aria-selected', 'true');
  await expect.element(thirdTrack).toHaveAttribute('aria-selected', 'true');
});

test('Search should filter tracks in the library', async () => {
  await setupScannedLibrary();

  const search = getPageHeaderSearch();
  const searchClear = getPageHeaderSearchClear();

  // Searching by a common word should display all tracks
  await search.fill('Blues');
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();

  // Searching by a specific word should display only the matching tracks,
  // regardless of accents and cases
  await search.fill('pixAbày');
  await expect.element(getTrackByName(/Whiskey Blues/)).not.toBeInTheDocument();
  await expect.element(getTrackByName(/Majestic Blues/)).toBeInTheDocument();
  await expect.element(getTrackByName(/Romantic Blues/)).toBeInTheDocument();

  await search.fill('hisk');
  await expect.element(getTrackByName(/Whiskey Blues/)).toBeInTheDocument();
  await expect
    .element(getTrackByName(/Majestic Blues/))
    .not.toBeInTheDocument();
  await expect
    .element(getTrackByName(/Romantic Blues/))
    .not.toBeInTheDocument();

  // Searching by an unknown word should display no tracks and a warning
  await search.fill('Something that does not exist');
  await expect.element(getTrackAt(0)).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('没有与“Something that does not exist”匹配的结果');

  // Clicking the search clear button should clear the search
  await searchClear.click();
  await expect.element(getTrackAt(0)).toBeInTheDocument();
  await expect.element(getTrackAt(1)).toBeInTheDocument();
  await expect.element(getTrackAt(2)).toBeInTheDocument();
});

test('Column headers should sort tracks in the library', async () => {
  await setupScannedLibrary();

  const firstTrack = getTrackAt(0);
  const secondTrack = getTrackAt(1);
  const thirdTrack = getTrackAt(2);

  const track0content =
    'Whiskey BluesCaptain_SleepyAnother Album05:00rock, blues';
  const track1content = 'Majestic BluesDesicomix07Pixabay05:00blues';
  const track2content = 'Romantic BluesJean-Paul-VPixabay05:00blues';

  // By default, we sort by artist, album year, album name, track number, disk number
  await expect.element(firstTrack).toHaveTextContent(track0content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track2content);

  // Clicking on the title header should change the sorting to Descending by Artist name
  await getSortButton('艺术家').click();
  await expect.element(firstTrack).toHaveTextContent(track2content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track0content);

  // Clicking again should change the sorting back to Ascending by Artist name
  await getSortButton('艺术家').click();
  await expect.element(firstTrack).toHaveTextContent(track0content);
  await expect.element(secondTrack).toHaveTextContent(track1content);
  await expect.element(thirdTrack).toHaveTextContent(track2content);

  // Let's sort by title as well
  await getSortButton('标题').click();
  await expect.element(firstTrack).toHaveTextContent(track1content);
  await expect.element(secondTrack).toHaveTextContent(track2content);
  await expect.element(thirdTrack).toHaveTextContent(track0content);
});
