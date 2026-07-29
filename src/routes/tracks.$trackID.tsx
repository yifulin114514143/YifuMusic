import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useCallback, useState } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import PlaylistsAPI from '../api/PlaylistsAPI';
import ContentHeader from '../components/ContentHeader';
import Cover from '../components/Cover';
import * as Setting from '../components/Setting';
import SettingCheckbox from '../components/SettingCheckbox';
import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import Flexbox from '../elements/Flexbox';
import Separator from '../elements/Separator';
import View from '../elements/View';
import { parseDuration } from '../hooks/useFormattedDuration';
import useInvalidate from '../hooks/useInvalidate';
import DatabaseBridge from '../lib/bridge-database';
import player from '../lib/player';
import { logAndNotifyError } from '../lib/utils';
import type { TrackMutation } from '../types/museeks';

// We assume no artist or genre has a comma in its name (fingers crossed)
const DELIMITER = ',';

export const Route = createFileRoute('/tracks/$trackID')({
  component: ViewTrackDetails,
  loader: async ({ params }) => {
    const { trackID } = params;

    if (trackID == null) {
      throw new Error('Track ID should not be null');
    }

    const [[track], playlists] = await Promise.all([
      DatabaseBridge.getTracks([trackID]),
      DatabaseBridge.getAllPlaylists(),
    ]);

    if (track == null) {
      throw new Error('Track not found');
    }

    return { track, playlists };
  },
});

function ViewTrackDetails() {
  const { track, playlists } = Route.useLoaderData();
  const invalidate = useInvalidate();
  const { t } = useLingui();

  const [formData, setFormData] = useState<TrackMutation>({
    title: track.title ?? '',
    album: track.album ?? '',
    artists: track.artists,
    album_artist: track.album_artist ?? '',
    genres: track.genres,
    year: track.year,
    track_no: track.track_no ?? null,
    track_of: track.track_of ?? null,
    disk_no: track.disk_no ?? null,
    disk_of: track.disk_of ?? null,
    is_compilation: track.is_compilation,
  });

  const router = useRouter();

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      await LibraryAPI.updateTrackMetadata(track.id, formData);
      await invalidate();
      router.history.back();
    },
    [track, formData, router, invalidate],
  );

  const handleCancel = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      router.history.back();
    },
    [router],
  );

  const playTrack = useCallback(() => {
    void player.start([track], track.id, { type: 'library' });
  }, [track]);

  const addToQueue = useCallback(() => {
    player.addToQueue([track]);
  }, [track]);

  const addToPlaylist = useCallback(async () => {
    const items = await Promise.all(
      playlists.map((playlist) =>
        MenuItem.new({
          text: playlist.name,
          async action() {
            await PlaylistsAPI.addTracks(playlist.id, [track.id]);
            await invalidate();
          },
        }),
      ),
    );

    const menu = await Menu.new({ items });
    await menu.popup().catch(logAndNotifyError);
  }, [invalidate, playlists, track.id]);

  return (
    <View hasPadding layout="centered">
      <ContentHeader
        title={track.title}
        description={track.artists.join(', ')}
        meta={`${track.album} / ${parseDuration(track.duration)}`}
        actions={
          <>
            <Button type="button" onClick={handleCancel}>
              {t`Back`}
            </Button>
            <ButtonIcon icon="play" label={t`Play`} onClick={playTrack} />
            <ButtonIcon
              icon="list"
              label={t`Add to queue`}
              onClick={addToQueue}
            />
            <Button
              type="button"
              disabled={playlists.length === 0}
              title={
                playlists.length === 0
                  ? t`Create a playlist before adding tracks`
                  : t`Add to playlist`
              }
              onClick={() => void addToPlaylist()}
            >
              {t`Add to playlist`}
            </Button>
            <Button
              type="button"
              onClick={() =>
                revealItemInDir(track.path).catch(logAndNotifyError)
              }
            >
              {t`Show in file manager`}
            </Button>
          </>
        }
      />
      <section aria-label={t`Track summary`} {...stylex.props(styles.summary)}>
        <div {...stylex.props(styles.summaryCover)}>
          <Cover track={track} iconSize={24} />
        </div>
        <dl {...stylex.props(styles.summaryMetadata)}>
          <div>
            <dt>{t`Album`}</dt>
            <dd>{track.album}</dd>
          </div>
          <div>
            <dt>{t`Artists`}</dt>
            <dd>{track.artists.join(', ')}</dd>
          </div>
          <div>
            <dt>{t`Genre`}</dt>
            <dd>{track.genres.join(', ')}</dd>
          </div>
          <div>
            <dt>{t`Year`}</dt>
            <dd>{track.year ?? t`Unknown`}</dd>
          </div>
          <div>
            <dt>{t`Duration`}</dt>
            <dd>{parseDuration(track.duration)}</dd>
          </div>
        </dl>
      </section>
      <form onSubmit={handleSubmit} {...stylex.props(styles.detailsForm)}>
        <h2>
          <Trans>Edit "{track.title}"</Trans>
        </h2>
        <Setting.Section>
          <Setting.Input
            label={t`Title`}
            name="title"
            type="text"
            value={formData.title}
            onChange={(e) => {
              setFormData({ ...formData, title: e.currentTarget.value });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Album`}
            name="album"
            type="text"
            value={formData.album}
            onChange={(e) => {
              setFormData({ ...formData, album: e.currentTarget.value });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Album Artist`}
            name="album_artist"
            type="text"
            value={formData.album_artist}
            onChange={(e) => {
              setFormData({
                ...formData,
                album_artist: e.currentTarget.value,
              });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Track Artists`}
            description={t`You can add multiple artists with commas`}
            name="artist"
            type="text"
            value={formData.artists.join(DELIMITER)}
            onChange={(e) => {
              setFormData({
                ...formData,
                artists: e.currentTarget.value.split(DELIMITER),
              });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Genre`}
            description={t`You can add multiple genres with commas`}
            name="genre"
            type="text"
            value={formData.genres.join(DELIMITER)}
            onChange={(e) => {
              setFormData({
                ...formData,
                genres: e.currentTarget.value.split(DELIMITER),
              });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Year`}
            name="year"
            type="number"
            min="0"
            step="1"
            value={Number(formData.year)}
            onChange={(e) => {
              setFormData({ ...formData, year: Number(e.currentTarget.value) });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Flexbox direction="horizontal" gap={16}>
            <Setting.Input
              label={t`Track Nº`}
              name="track"
              type="number"
              min="0"
              step="1"
              value={formData.track_no ?? ''}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  track_no: parseNullableNumber(e.currentTarget.value),
                });
              }}
            />
            <Setting.Input
              label={t`Of`}
              name="trackOf"
              type="number"
              min="0"
              step="1"
              value={formData.track_of ?? ''}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  track_of: parseNullableNumber(e.currentTarget.value),
                });
              }}
            />
          </Flexbox>
        </Setting.Section>
        <Setting.Section>
          <Flexbox direction="horizontal" gap={16}>
            <Setting.Input
              label={t`Disk Nº`}
              name="disk"
              type="number"
              min="0"
              step="1"
              value={formData.disk_no ?? ''}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  disk_no: parseNullableNumber(e.currentTarget.value),
                });
              }}
            />
            <Setting.Input
              label={t`Of`}
              name="diskOf"
              type="number"
              min="0"
              step="1"
              value={formData.disk_of ?? ''}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  disk_of: parseNullableNumber(e.currentTarget.value),
                });
              }}
            />
          </Flexbox>
        </Setting.Section>
        <Setting.Section>
          <SettingCheckbox
            title={t`Compilation`}
            description={t`Group this track with other tracks from the same compilation, regardless of the artist names.`}
            value={formData.is_compilation}
            onChange={(value) => {
              setFormData({ ...formData, is_compilation: value });
            }}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Duration`}
            type="text"
            disabled
            value={parseDuration(track.duration)}
          />
        </Setting.Section>
        <Setting.Section>
          <Setting.Input
            label={t`Path`}
            type="text"
            disabled
            value={track.path}
          />
        </Setting.Section>
        <div {...stylex.props(styles.detailsActions)}>
          <Button type="button" onClick={handleCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit">
            <Trans>Save</Trans>
          </Button>
        </div>
        <Separator />
        <p>
          <Trans>
            Clicking "save" will only update the library data, but will not save
            it to the original file.
          </Trans>
        </p>
      </form>
    </View>
  );
}

function parseNullableNumber(str: string): number | null {
  if (str === '' || str === '0') {
    return null;
  }

  return Number(str);
}

const styles = stylex.create({
  summary: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    columnGap: '16px',
    paddingBlock: '16px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--border-subtle)',
  },
  summaryCover: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderRadius: 'var(--radius-sm)',
  },
  summaryMetadata: {
    minWidth: 0,
    margin: 0,
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 599px)': 'minmax(0, 1fr)',
    },
    rowGap: '8px',
    columnGap: '16px',
  },
  detailsForm: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: '24px',
  },
  detailsActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    rowGap: '8px',
    columnGap: '8px',
    marginBottom: '16px',
  },
});
