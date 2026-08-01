import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type React from 'react';
import { useCallback, useState } from 'react';

import LibraryAPI from '../api/LibraryAPI';
import PlaylistsAPI from '../api/PlaylistsAPI';
import Cover from '../components/Cover';
import DesktopLyricsButton from '../components/DesktopLyricsButton';
import * as Setting from '../components/Setting';
import SettingCheckbox from '../components/SettingCheckbox';
import Button from '../elements/Button';
import ButtonIcon from '../elements/ButtonIcon';
import Flexbox from '../elements/Flexbox';
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

  const addNextInQueue = useCallback(() => {
    player.addNextInQueue([track]);
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
    <View xstyle={styles.view}>
      <div {...stylex.props(styles.page)}>
        <section
          aria-label={`本地曲目资料：${track.title}`}
          data-reference-layout="moekoe-track-detail"
          {...stylex.props(styles.hero)}
        >
          <div {...stylex.props(styles.cover)}>
            <Cover track={track} iconSize={36} />
          </div>
          <div {...stylex.props(styles.heroCopy)}>
            <span {...stylex.props(styles.eyebrow)}>本地曲目</span>
            <h2 id="track-detail-title" {...stylex.props(styles.title)}>
              {track.title}
            </h2>
            <p {...stylex.props(styles.artists)}>
              {displayMetadataValue(track.artists.join(', '))}
            </p>
            <p {...stylex.props(styles.albumLine)}>
              {displayMetadataValue(track.album)} ·{' '}
              {parseDuration(track.duration)}
            </p>
            <dl {...stylex.props(styles.heroStats)}>
              <div {...stylex.props(styles.heroStat)}>
                <dt {...stylex.props(styles.heroStatLabel)}>专辑</dt>
                <dd {...stylex.props(styles.heroStatValue)}>
                  {displayMetadataValue(track.album)}
                </dd>
              </div>
              <div {...stylex.props(styles.heroStat)}>
                <dt {...stylex.props(styles.heroStatLabel)}>时长</dt>
                <dd {...stylex.props(styles.heroStatValue)}>
                  {parseDuration(track.duration)}
                </dd>
              </div>
              <div {...stylex.props(styles.heroStat)}>
                <dt {...stylex.props(styles.heroStatLabel)}>曲序</dt>
                <dd {...stylex.props(styles.heroStatValue)}>
                  {formatTrackPosition(track.track_no, track.track_of)}
                </dd>
              </div>
              <div {...stylex.props(styles.heroStat)}>
                <dt {...stylex.props(styles.heroStatLabel)}>格式</dt>
                <dd {...stylex.props(styles.heroStatValue)}>
                  {getTrackFormat(track.path)}
                </dd>
              </div>
            </dl>
          </div>
          <div
            aria-label="曲目操作"
            role="group"
            {...stylex.props(styles.heroActions)}
          >
            <Button type="button" onClick={handleCancel}>
              {t`Back`}
            </Button>
            <ButtonIcon
              icon="play"
              label={t`Play`}
              onClick={playTrack}
              xstyle={styles.primaryAction}
            />
            <ButtonIcon
              icon="list"
              label={t`Add to queue`}
              onClick={addToQueue}
              xstyle={styles.secondaryAction}
            />
            <Button
              aria-label={`下一首播放 ${track.title}`}
              title="下一首播放"
              type="button"
              onClick={addNextInQueue}
            >
              下一首播放
            </Button>
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
              aria-label={`在文件管理器中显示 ${track.title}`}
              title="在文件管理器中显示"
              type="button"
              onClick={() =>
                revealItemInDir(track.path).catch(logAndNotifyError)
              }
            >
              {t`Show in file manager`}
            </Button>
            <DesktopLyricsButton />
          </div>
        </section>

        <section
          aria-label="曲目在线服务状态"
          data-testid="track-detail-service-actions"
          {...stylex.props(styles.serviceActions)}
        >
          <span>在线服务尚未接入。</span>
          {['在线歌词', '远程专辑资料', '在线分享', 'MV'].map((label) => (
            <button
              key={label}
              aria-disabled="true"
              aria-label={`${label}，服务接入后可用`}
              disabled
              title={`${label}：服务接入后可用`}
              type="button"
              {...stylex.props(styles.disabledServiceAction)}
            >
              {label}
            </button>
          ))}
        </section>

        <section
          aria-label="本地曲目资料详情"
          {...stylex.props(styles.metadata)}
        >
          <header {...stylex.props(styles.sectionHeader)}>
            <div>
              <span {...stylex.props(styles.sectionEyebrow)}>文件元数据</span>
              <h2
                id="track-metadata-title"
                {...stylex.props(styles.sectionTitle)}
              >
                本地资料
              </h2>
              <p {...stylex.props(styles.sectionDescription)}>
                来自已经导入音乐库的本地音频文件
              </p>
            </div>
          </header>
          <dl {...stylex.props(styles.metadataGrid)}>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>专辑</dt>
              <dd>{displayMetadataValue(track.album)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>歌手</dt>
              <dd>{displayMetadataValue(track.artists.join(', '))}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>专辑歌手</dt>
              <dd>{displayMetadataValue(track.album_artist)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>流派</dt>
              <dd>{displayMetadataValue(track.genres.join(', '))}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>年份</dt>
              <dd>{displayMetadataValue(track.year)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>曲序</dt>
              <dd>{formatTrackPosition(track.track_no, track.track_of)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>碟序</dt>
              <dd>{formatTrackPosition(track.disk_no, track.disk_of)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>时长</dt>
              <dd>{parseDuration(track.duration)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>文件格式</dt>
              <dd>{getTrackFormat(track.path)}</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>文件大小</dt>
              <dd>暂无本地文件信息</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>比特率</dt>
              <dd>暂无本地文件信息</dd>
            </div>
            <div {...stylex.props(styles.metadataItem)}>
              <dt>采样率</dt>
              <dd>暂无本地文件信息</dd>
            </div>
            <div {...stylex.props(styles.metadataItem, styles.pathItem)}>
              <dt>文件位置</dt>
              <dd title={track.path}>{track.path}</dd>
            </div>
          </dl>
        </section>

        <form
          aria-labelledby="track-edit-title"
          onSubmit={handleSubmit}
          {...stylex.props(styles.detailsForm)}
        >
          <header {...stylex.props(styles.sectionHeader)}>
            <div>
              <span {...stylex.props(styles.sectionEyebrow)}>应用内音乐库</span>
              <h2 id="track-edit-title" {...stylex.props(styles.sectionTitle)}>
                编辑本地资料
              </h2>
              <p {...stylex.props(styles.sectionDescription)}>
                保存只会更新应用内部的音乐库数据，不会写回原始音频文件。
              </p>
            </div>
          </header>
          <div {...stylex.props(styles.editGrid)}>
            <Setting.Section>
              <Setting.Title>基础资料</Setting.Title>
              <Setting.Input
                label={t`Title`}
                name="title"
                type="text"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.currentTarget.value });
                }}
              />
              <Setting.Input
                label={t`Album`}
                name="album"
                type="text"
                value={formData.album}
                onChange={(e) => {
                  setFormData({ ...formData, album: e.currentTarget.value });
                }}
              />
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
              <Setting.Title>排序与分组</Setting.Title>
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
              <Setting.Input
                label={t`Year`}
                name="year"
                type="number"
                min="0"
                step="1"
                value={Number(formData.year)}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    year: Number(e.currentTarget.value),
                  });
                }}
              />
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
              <Setting.Title>只读文件信息</Setting.Title>
              <Setting.Input
                label={t`Duration`}
                type="text"
                disabled
                value={parseDuration(track.duration)}
              />
              <Setting.Input
                label={t`Path`}
                type="text"
                disabled
                value={track.path}
              />
            </Setting.Section>
          </div>
          <div {...stylex.props(styles.detailsActions)}>
            <Button type="button" onClick={handleCancel}>
              {t`Cancel`}
            </Button>
            <Button type="submit">{t`Save`}</Button>
          </div>
        </form>
      </div>
    </View>
  );
}

function parseNullableNumber(str: string): number | null {
  if (str === '' || str === '0') {
    return null;
  }

  return Number(str);
}

function displayMetadataValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return String(value);
}

function formatTrackPosition(position: number | null, total: number | null) {
  if (position === null && total === null) {
    return '—';
  }

  if (position === null) {
    return `共 ${total}`;
  }

  if (total === null) {
    return String(position);
  }

  return `${position} / ${total}`;
}

function getTrackFormat(path: string): string {
  const fileName = path.split(/[\\/]/).at(-1) ?? path;
  const extensionIndex = fileName.lastIndexOf('.');

  if (extensionIndex === -1 || extensionIndex === fileName.length - 1) {
    return '未知格式';
  }

  return fileName.slice(extensionIndex + 1).toLocaleUpperCase();
}

const styles = stylex.create({
  view: {
    padding: 0,
  },
  page: {
    width: 'min(1040px, 100%)',
    marginInline: 'auto',
    padding: {
      default: '26px 20px 32px',
      '@media (max-width: 699px)': '18px 14px 22px',
    },
    display: 'flex',
    flexDirection: 'column',
    rowGap: '22px',
  },
  hero: {
    minWidth: 0,
    padding: {
      default: '22px',
      '@media (max-width: 699px)': '16px',
    },
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: '18px',
    rowGap: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '14px',
    backgroundColor: 'var(--surface-raised)',
    backgroundImage:
      'linear-gradient(115deg, var(--surface-raised) 0%, var(--surface-selected) 100%)',
    boxShadow: '0 10px 26px rgba(30, 55, 78, 0.08)',
  },
  serviceActions: {
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-raised)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    fontSize: '12px',
  },
  disabledServiceAction: {
    minHeight: '30px',
    paddingInline: '9px',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '999px',
    cursor: 'not-allowed',
    fontFamily: 'inherit',
    fontSize: '12px',
  },
  cover: {
    width: '130px',
    height: '130px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: '12px',
    boxShadow: '0 8px 20px rgba(20, 30, 38, 0.16)',
  },
  heroCopy: {
    minWidth: 0,
    flexGrow: 1,
    flexBasis: '320px',
  },
  eyebrow: {
    display: 'block',
    marginBottom: '5px',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 750,
    letterSpacing: '0.08em',
  },
  title: {
    minWidth: 0,
    margin: 0,
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: {
      default: '30px',
      '@media (max-width: 699px)': '25px',
    },
    fontWeight: 800,
    lineHeight: 1.18,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artists: {
    marginTop: '8px',
    marginBottom: 0,
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: 650,
    lineHeight: 1.45,
  },
  albumLine: {
    marginTop: '4px',
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.45,
  },
  heroStats: {
    width: 'min(450px, 100%)',
    marginTop: '16px',
    marginBottom: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    backgroundColor: 'var(--surface-canvas)',
  },
  heroStat: {
    minWidth: 0,
    paddingBlock: '9px',
    paddingInline: '12px',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderRightColor: 'var(--border-subtle)',
  },
  heroStatLabel: {
    display: 'block',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    lineHeight: 1.3,
  },
  heroStatValue: {
    display: 'block',
    marginTop: '3px',
    overflow: 'hidden',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  heroActions: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
  primaryAction: {
    width: '40px',
    height: '40px',
    color: 'var(--accent-contrast)',
    borderRadius: '999px',
    backgroundColor: 'var(--accent)',
  },
  secondaryAction: {
    width: '38px',
    height: '38px',
    color: 'var(--accent)',
    borderRadius: '999px',
    backgroundColor: 'var(--surface-selected)',
  },
  metadata: {
    minWidth: 0,
    padding: '18px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
    backgroundColor: 'var(--surface-raised)',
  },
  sectionHeader: {
    marginBottom: '14px',
  },
  sectionEyebrow: {
    display: 'block',
    marginBottom: '4px',
    color: 'var(--accent)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.07em',
  },
  sectionTitle: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: '20px',
    lineHeight: 1.2,
  },
  sectionDescription: {
    marginTop: '6px',
    marginBottom: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.45,
  },
  metadataGrid: {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(3, minmax(0, 1fr))',
      '@media (max-width: 799px)': 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 499px)': 'minmax(0, 1fr)',
    },
    rowGap: '1px',
    columnGap: '1px',
    overflow: 'hidden',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '10px',
    backgroundColor: 'var(--border-subtle)',
  },
  metadataItem: {
    minWidth: 0,
    minHeight: '68px',
    paddingBlock: '11px',
    paddingInline: '12px',
    backgroundColor: 'var(--surface-canvas)',
  },
  pathItem: {
    gridColumn: {
      default: 'span 3',
      '@media (max-width: 799px)': 'span 2',
      '@media (max-width: 499px)': 'span 1',
    },
  },
  detailsForm: {
    minWidth: 0,
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '12px',
    backgroundColor: 'var(--surface-canvas)',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: {
      default: 'repeat(2, minmax(0, 1fr))',
      '@media (max-width: 759px)': 'minmax(0, 1fr)',
    },
    alignItems: 'start',
    rowGap: '14px',
    columnGap: '14px',
  },
  detailsActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    rowGap: '8px',
    columnGap: '8px',
  },
});
