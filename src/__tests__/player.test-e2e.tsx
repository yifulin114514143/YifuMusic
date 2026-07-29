import { expect, test } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getTrackByName,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('Double click on a track should play it and display its metadata', async () => {
  const playerHeader = page.getByRole('banner', { name: 'Player' });

  // By default, the player is paused
  await expect
    .element(playerHeader.getByRole('button', { name: 'Play', exact: true }))
    .toBeInTheDocument();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Pause', exact: true }))
    .not.toBeInTheDocument();

  await setupScannedLibrary();

  // Double-clicking on a track should start the player
  await getTrackByName(/Whiskey Blues/).dblClick();

  await expect
    .element(playerHeader.getByRole('button', { name: 'Play', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Pause', exact: true }))
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

  const slider = page.getByRole('slider', { name: 'Playback progress' });
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

  audio.currentTime = 45;
  audio.dispatchEvent(new Event('timeupdate'));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(sliderElement.value).toBe('45');
  expect(player.getState().currentTime).toBe(45);

  // Click on another one
  Reflect.deleteProperty(audio, 'duration');
  await getTrackByName(/Romantic Blues/).dblClick();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Play', exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Pause', exact: true }))
    .toBeInTheDocument();

  // Check the new track info is there
  await expect
    .element(page.getByRole('banner').getByText('Romantic Blues'))
    .toBeVisible();
  await expect
    .element(page.getByRole('banner'))
    .toHaveTextContent('Jean-Paul-V — Pixabay');

  const nextSlider = page.getByRole('slider', { name: 'Playback progress' });
  const nextSliderElement = nextSlider.element() as HTMLInputElement;
  expect(nextSliderElement.value).toBe('0');
  expect(nextSliderElement.max).toBe('300');
  expect(player.getState()).toMatchObject({
    currentTime: 0,
    duration: 300,
    mediaDuration: null,
    isMetadataLoaded: false,
  });

  // Pause
  await playerHeader
    .getByRole('button', { name: 'Pause', exact: true })
    .click();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Play', exact: true }))
    .toBeInTheDocument();
  await expect
    .element(playerHeader.getByRole('button', { name: 'Pause', exact: true }))
    .not.toBeInTheDocument();
});

test('timeupdate synchronizes real duration to the playing UI without metadata events', async () => {
  const player = (await import('../lib/player')).default;
  const audio = (player as unknown as { audio: HTMLAudioElement }).audio;
  Reflect.deleteProperty(audio, 'duration');

  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const slider = page.getByRole('slider', { name: 'Playback progress' });
  const sliderElement = slider.element() as HTMLInputElement;
  expect(sliderElement.max).toBe('300');

  const duration = 269.815873015873;
  Object.defineProperty(audio, 'duration', {
    configurable: true,
    value: duration,
  });
  audio.currentTime = 260.013;
  audio.dispatchEvent(new Event('timeupdate'));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(player.getState()).toMatchObject({
    mediaDuration: duration,
    duration,
  });
  expect(Number(sliderElement.max)).toBeCloseTo(duration, 10);
  await expect
    .element(page.getByRole('banner').getByText('04:29', { exact: true }))
    .toBeVisible();
  Reflect.deleteProperty(audio, 'duration');
});

test('Playback mode button cycles repeat modes and persists the selected state', async () => {
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const sequential = page.getByRole('button', {
    name: 'Playback mode: Sequential',
  });
  await sequential.click();
  await expect
    .element(page.getByRole('button', { name: 'Playback mode: Repeat all' }))
    .toHaveAttribute('aria-pressed', 'true');

  const { default: configBridge } = await import('../lib/bridge-config');
  expect(await configBridge.getAll()).toMatchObject({
    audio_playback_mode: 'repeat-all',
    audio_shuffle: false,
    audio_repeat: 'All',
  });

  await page.getByRole('button', { name: 'Playback mode: Repeat all' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Playback mode: Repeat one' }))
    .toHaveAttribute('aria-pressed', 'mixed');
});

test('shuffle button toggles the real player mode and persists it', async () => {
  const player = (await import('../lib/player')).default;
  await player.setPlaybackMode('sequential');
  await setupScannedLibrary();
  await getTrackByName(/Whiskey Blues/).dblClick();

  const shuffle = page.getByRole('button', { name: 'Shuffle' });
  await expect.element(shuffle).toHaveAttribute('aria-pressed', 'false');

  await shuffle.click();

  await expect.element(shuffle).toHaveAttribute('aria-pressed', 'true');
  expect(player.getState().playbackMode).toBe('shuffle');

  const { default: configBridge } = await import('../lib/bridge-config');
  expect(await configBridge.getAll()).toMatchObject({
    audio_playback_mode: 'shuffle',
    audio_shuffle: true,
    audio_repeat: 'None',
  });
});
