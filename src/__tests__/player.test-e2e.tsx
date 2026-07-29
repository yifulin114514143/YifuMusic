import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('Double click on a track should play it and display its metadata', async () => {
  // By default, the player is paused
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .not.toBeInTheDocument();

  await setupScannedLibrary();

  // Double-clicking on a track should start the player
  await getTrackByName(/Whiskey Blues/).dblClick();

  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .toBeInTheDocument();

  // Check the track info is there
  await expect
    .element(page.getByRole('banner').getByText('Whiskey Blues'))
    .toBeVisible();
  await expect
    .element(page.getByRole('banner'))
    .toHaveTextContent('Captain_Sleepy — Another Album');

  const player = (await import('../lib/player')).default;
  const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
  Object.defineProperty(audio, 'duration', {
    configurable: true,
    value: 150,
  });
  audio.dispatchEvent(new Event('loadedmetadata'));
  player.pause();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const slider = page.getByRole('slider', { name: '播放进度' });
  const sliderElement = slider.element() as HTMLInputElement;
  expect(sliderElement.max).toBe('150');
  expect(player.getState().duration).toBe(150);

  Object.defineProperty(audio, 'duration', {
    configurable: true,
    value: 147,
  });
  audio.dispatchEvent(new Event('durationchange'));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(sliderElement.max).toBe('147');
  expect(player.getState().duration).toBe(147);

  // Click on another one
  await getTrackByName(/Romantic Blues/).dblClick();
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .toBeInTheDocument();

  // Check the new track info is there
  await expect
    .element(page.getByRole('banner').getByText('Romantic Blues'))
    .toBeVisible();
  await expect
    .element(page.getByRole('banner'))
    .toHaveTextContent('Jean-Paul-V — Pixabay');

  // Pause
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Play' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Pause' }))
    .not.toBeInTheDocument();
});

test('Playback mode menu is interactive and keeps menu actions outside drag regions', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const player = (await import('../lib/player')).default;
  const setPlaybackMode = vi
    .spyOn(player, 'setPlaybackMode')
    .mockResolvedValue();

  const trigger = page.getByRole('button', { name: /播放模式/ });
  await expect.element(trigger).toHaveAttribute('data-museeks-action', 'true');
  await trigger.click();

  const menu = page.getByRole('menu', { name: '播放模式' });
  await expect.element(menu).toBeInTheDocument();
  for (const label of ['顺序播放', '随机播放', '单曲循环', '列表循环']) {
    await expect
      .element(page.getByRole('menuitemradio', { name: label }))
      .toHaveAttribute('data-museeks-action', 'true');
  }

  await userEvent.keyboard('[ArrowDown]');
  await userEvent.keyboard('[Enter]');
  expect(setPlaybackMode).toHaveBeenCalledWith('shuffle');

  await trigger.click();
  await page.getByRole('menuitemradio', { name: '顺序播放' }).click();
  expect(setPlaybackMode).toHaveBeenCalledWith('sequential');

  await trigger.click();
  await page.getByRole('menuitemradio', { name: '单曲循环' }).click();
  expect(setPlaybackMode).toHaveBeenCalledWith('repeat-one');

  await trigger.click();
  await page.getByRole('menuitemradio', { name: '列表循环' }).click();
  expect(setPlaybackMode).toHaveBeenCalledWith('repeat-all');

  await trigger.click();
  await userEvent.keyboard('[Escape]');
  await expect.element(menu).not.toBeInTheDocument();

  setPlaybackMode.mockRestore();
});
