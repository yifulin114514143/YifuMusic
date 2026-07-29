import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';
import { cleanup, render } from 'vitest-browser-react';

import type { Track } from '../generated/typings';
import { MOCK_CONFIG } from '../lib/__mocks__/bridge-config';
import { messages } from '../translations/en.po';

type SliderRootProps = {
  children: React.ReactNode;
  onValueChange: (value: number) => void;
  onValueCommitted: (value: number) => void;
};

type WithChildren = {
  children: React.ReactNode;
};

const TRACK: Track = {
  id: 'track-progress-test',
  path: '/track-progress-test.mp3',
  title: 'Track Progress Test',
  album: 'Test Album',
  album_artist: 'Test Artist',
  artists: ['Test Artist'],
  genres: [],
  year: null,
  duration: 269.815873015873,
  track_no: 1,
  track_of: 1,
  disk_no: 1,
  disk_of: 1,
  is_compilation: false,
};

let TrackProgress: typeof import('./TrackProgress').default;
let player: typeof import('../lib/player').default;
let setCurrentTime = vi.fn<(time: number) => void>();

beforeEach(async () => {
  vi.stubGlobal('__MUSEEKS_INITIAL_CONFIG', MOCK_CONFIG);
  vi.stubGlobal('__MUSEEKS_STREAM_SERVER_URL', null);
  vi.doMock('@base-ui/react/slider', () => ({
    Slider: {
      Root: ({
        children,
        onValueChange,
        onValueCommitted,
      }: SliderRootProps) => (
        <div>
          <button
            aria-label="Preview slider"
            onClick={() => {
              onValueChange(15);
              onValueChange(30);
              onValueChange(45);
            }}
            type="button"
          />
          <button
            aria-label="Commit slider"
            onClick={() => onValueCommitted(264)}
            type="button"
          />
          {children}
        </div>
      ),
      Control: ({ children }: WithChildren) => <div>{children}</div>,
      Track: ({ children }: WithChildren) => <div>{children}</div>,
      Indicator: () => <div />,
      Thumb: () => <input aria-label="Playback progress" type="range" />,
    },
  }));
  ({ default: player } = await import('../lib/player'));
  player.addToQueue([TRACK]);
  setCurrentTime = vi.fn<(time: number) => void>();
  player.setCurrentTime = setCurrentTime;
  ({ default: TrackProgress } = await import('./TrackProgress'));
  i18n.load('en', messages);
  i18n.activate('en');
});

afterEach(async () => {
  await cleanup();
  vi.doUnmock('@base-ui/react/slider');
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

test('previews multiple slider values without seeking and commits once', async () => {
  await render(
    <I18nProvider i18n={i18n}>
      <TrackProgress trackPlaying={TRACK} />
    </I18nProvider>,
  );

  await page.getByRole('button', { name: 'Preview slider' }).click();
  expect(setCurrentTime).not.toHaveBeenCalled();

  await page.getByRole('button', { name: 'Commit slider' }).click();
  expect(setCurrentTime).toHaveBeenCalledTimes(1);
  expect(setCurrentTime).toHaveBeenCalledWith(264);
});
