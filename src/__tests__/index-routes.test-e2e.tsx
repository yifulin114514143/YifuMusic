import { expect, test, vi } from 'vite-plus/test';
import { page, userEvent } from 'vite-plus/test/browser';

import {
  beforeEachSetup,
  getMainNavigation,
  getTrackAt,
  setupScannedLibrary,
} from './e2e-helpers';

beforeEachSetup();

test('Library shows local statistics and Escape clears the current search', async () => {
  await setupScannedLibrary();

  await expect
    .element(page.getByRole('heading', { name: 'Library', level: 2 }))
    .toBeInTheDocument();
  await expect.element(page.getByText('3 tracks / 15:00')).toBeInTheDocument();

  const search = page.getByRole('textbox', { name: 'Search library' });
  await search.fill('Nothing matches this search');
  await expect
    .element(page.getByRole('status'))
    .toHaveTextContent('No results for "Nothing matches this search"');

  await userEvent.keyboard('{Escape}');
  await expect.element(search).toHaveValue('');
  await expect.element(getTrackAt(0)).toBeInTheDocument();
});

test('Artists retain backend order while filtering by the global search', async () => {
  const { default: DatabaseBridge } = await import('../lib/bridge-database');
  vi.spyOn(DatabaseBridge, 'getAllArtists').mockResolvedValue([
    'Éclair',
    'Alpha',
  ]);

  await getMainNavigation().getByRole('link', { name: 'Artists' }).click();

  const artistLinks = page.getByRole('link', { name: /Éclair|Alpha/ });
  await expect.element(artistLinks.nth(0)).toHaveTextContent('Éclair');
  await expect.element(artistLinks.nth(1)).toHaveTextContent('Alpha');
  await expect.element(page.getByText('2 artists')).toBeInTheDocument();

  const search = page.getByRole('textbox', { name: 'Search library' });
  await search.fill('ecl');

  await expect
    .element(page.getByRole('link', { name: 'Éclair' }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole('link', { name: 'Alpha' }))
    .not.toBeInTheDocument();
});

test('Empty playlists explain the existing M3U scan path', async () => {
  await getMainNavigation().getByRole('link', { name: 'Playlists' }).click();

  const emptyState = page.getByRole('status');
  await expect.element(emptyState).toHaveTextContent('No playlists yet');
  await expect
    .element(emptyState)
    .toHaveTextContent(
      'Scan a music folder that contains .m3u files in library settings to import them as playlists.',
    );
  await expect
    .element(page.getByRole('button', { name: 'Create a playlist' }))
    .toBeInTheDocument();
});
