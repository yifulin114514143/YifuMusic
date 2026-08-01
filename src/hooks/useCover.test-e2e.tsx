import { useState } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import type { Track } from '../generated/typings';
import useCover from './useCover';

type GetCover = (path: string) => Promise<string | null>;

const FIRST_TRACK: Track = {
  id: 'first-cover-track',
  path: '/music/first-cover-track.mp3',
  title: 'First cover track',
  album: 'Cover test album',
  album_artist: 'Cover test artist',
  artists: ['Cover test artist'],
  genres: [],
  year: null,
  duration: 180,
  track_no: 1,
  track_of: 1,
  disk_no: 1,
  disk_of: 1,
  is_compilation: false,
};

const SECOND_TRACK: Track = {
  ...FIRST_TRACK,
  id: 'second-cover-track',
  path: '/music/second-cover-track.mp3',
  title: 'Second cover track',
};

let getCoverMock: ReturnType<typeof vi.fn<GetCover>>;

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
}

function CoverPathProbe() {
  const [track, setTrack] = useState(FIRST_TRACK);
  const coverPath = useCover(track, getCoverMock);

  return (
    <>
      <output data-testid="cover-path" data-value={coverPath ?? ''} />
      <button type="button" onClick={() => setTrack(SECOND_TRACK)}>
        Switch track
      </button>
    </>
  );
}

beforeEach(async () => {
  getCoverMock = vi.fn<GetCover>();
});

afterEach(async () => {
  await cleanup();
  vi.restoreAllMocks();
  vi.resetModules();
});

test('clears the displayed cover while the next track cover is loading', async () => {
  const firstCover = createDeferred<string | null>();
  const secondCover = createDeferred<string | null>();
  getCoverMock.mockImplementation((path) => {
    if (path === FIRST_TRACK.path) return firstCover.promise;
    if (path === SECOND_TRACK.path) return secondCover.promise;
    throw new Error(`Unexpected track path: ${path}`);
  });

  await render(<CoverPathProbe />);
  await vi.waitFor(() => {
    expect(getCoverMock).toHaveBeenCalledWith(FIRST_TRACK.path);
  });

  firstCover.resolve('data:image/png;base64,first-cover');
  await expect
    .element(page.getByTestId('cover-path'))
    .toHaveAttribute('data-value', 'data:image/png;base64,first-cover');

  await page.getByRole('button', { name: 'Switch track' }).click();

  await expect
    .element(page.getByTestId('cover-path'))
    .toHaveAttribute('data-value', '');
  await vi.waitFor(() => {
    expect(getCoverMock).toHaveBeenCalledWith(SECOND_TRACK.path);
  });

  secondCover.resolve('data:image/png;base64,second-cover');
  await expect
    .element(page.getByTestId('cover-path'))
    .toHaveAttribute('data-value', 'data:image/png;base64,second-cover');
});

test('ignores a previous cover request that resolves after the track changes', async () => {
  const firstCover = createDeferred<string | null>();
  const secondCover = createDeferred<string | null>();
  getCoverMock.mockImplementation((path) => {
    if (path === FIRST_TRACK.path) return firstCover.promise;
    if (path === SECOND_TRACK.path) return secondCover.promise;
    throw new Error(`Unexpected track path: ${path}`);
  });

  await render(<CoverPathProbe />);
  await vi.waitFor(() => {
    expect(getCoverMock).toHaveBeenCalledWith(FIRST_TRACK.path);
  });

  await page.getByRole('button', { name: 'Switch track' }).click();
  await vi.waitFor(() => {
    expect(getCoverMock).toHaveBeenCalledWith(SECOND_TRACK.path);
  });

  secondCover.resolve('data:image/png;base64,second-cover');
  await expect
    .element(page.getByTestId('cover-path'))
    .toHaveAttribute('data-value', 'data:image/png;base64,second-cover');

  firstCover.resolve('data:image/png;base64,first-cover');
  await Promise.resolve();

  await expect
    .element(page.getByTestId('cover-path'))
    .toHaveAttribute('data-value', 'data:image/png;base64,second-cover');
});
