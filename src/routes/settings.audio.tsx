import { useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import SettingsAPI from '../api/SettingsAPI';
import Icon from '../components/Icon';
import * as Setting from '../components/Setting';
import useInvalidate, { useInvalidateCallback } from '../hooks/useInvalidate';
import player from '../lib/player';
import { configQuery } from '../lib/queries';
import { logAndNotifyError } from '../lib/utils';

export const Route = createFileRoute('/settings/audio')({
  component: ViewSettingsAudio,
});

function ViewSettingsAudio() {
  const config = useSuspenseQuery(configQuery).data;

  const invalidate = useInvalidate();
  const { t } = useLingui();

  return (
    <>
      <Setting.PageHeader
        title={t`Playback`}
        description={t`Adjust how YifuMusic plays your local music.`}
      />
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="play" size={16} />
            {t`Playback`}
          </span>
        </Setting.Title>
        <Setting.Description>
          {t`Adjust how YifuMusic plays your local music.`}
        </Setting.Description>
        <Setting.Input
          label={t`Playback rate`}
          description={t`Increase the playback rate: a value of 2 will play your music at a 2x speed`}
          value={config.audio_playback_rate ?? ''}
          onChange={(e) =>
            player
              .setPlaybackRate(Number.parseFloat(e.currentTarget.value))
              .then(invalidate)
              .catch(logAndNotifyError)
          }
          type="number"
          min="0.5"
          max="5"
          step="0.1"
        />
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="musicalNotes" size={16} />
            跟随播放
          </span>
        </Setting.Title>
        <Setting.Toggle
          title={t`Follow playing track`}
          description={t`Automatically follow the currently playing track (only when the app is not focused)`}
          value={config.audio_follow_playing_track}
          onChange={useInvalidateCallback(SettingsAPI.toggleFollowPlayingTrack)}
        />
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="volumeHigh" size={16} />
            播放通知
          </span>
        </Setting.Title>
        <Setting.Toggle
          title={t`Display Notifications`}
          description={t`Send notifications when the playing track changes`}
          value={config.notifications}
          onChange={useInvalidateCallback(
            SettingsAPI.toggleDisplayNotifications,
          )}
        />
      </Setting.Section>
    </>
  );
}

const styles = stylex.create({
  cardTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '8px',
    color: 'var(--text-primary)',
  },
});
