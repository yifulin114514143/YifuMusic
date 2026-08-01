import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useLoaderData } from '@tanstack/react-router';

import SettingsAPI from '../api/SettingsAPI';
import Icon from '../components/Icon';
import * as Setting from '../components/Setting';
import Button from '../elements/Button';
import ExternalButton from '../elements/ExternalButton';
import ExternalLink from '../elements/ExternalLink';
import Flexbox from '../elements/Flexbox';
import useInvalidate, { useInvalidateCallback } from '../hooks/useInvalidate';
import { configQuery } from '../lib/queries';
import { logAndNotifyError } from '../lib/utils';

export const Route = createFileRoute('/settings/about')({
  component: ViewSettingsAbout,
});

function ViewSettingsAbout() {
  const { version, tauriVersion, appStorageDir } = useLoaderData({
    from: '/settings',
  });
  const config = useSuspenseQuery(configQuery).data;

  const invalidate = useInvalidate();
  const { t } = useLingui();

  return (
    <>
      <Setting.PageHeader
        title={t`About YifuMusic`}
        description={`YifuMusic ${version}`}
      />
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="refresh" size={16} />
            版本与更新
          </span>
        </Setting.Title>
        <Setting.Description>
          YifuMusic {version}
          {' - '}
          <ExternalLink
            href="https://github.com/yifulin114514143/YifuMusic"
            type="url"
          >
            {t`project repository`}
          </ExternalLink>
          {' - '}
          <ExternalLink
            href="https://github.com/yifulin114514143/YifuMusic/releases"
            type="url"
          >{t`release notes`}</ExternalLink>
        </Setting.Description>
        <Setting.Toggle
          title={t`Automatically check for updates`}
          description={t`Check for an available YifuMusic release when the app starts`}
          value={config.auto_update_checker}
          onChange={useInvalidateCallback(SettingsAPI.toggleAutoUpdateChecker)}
        />
        <div>
          <Button
            onClick={() => {
              SettingsAPI.checkForUpdate()
                .then(invalidate)
                .catch(logAndNotifyError);
            }}
          >
            <Trans>Check for update</Trans>
          </Button>
        </div>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="fileText" size={16} />
            <Trans>Licenses and notices</Trans>
          </span>
        </Setting.Title>
        <Setting.Description>
          <Trans>
            YifuMusic is a modification of Museeks and is distributed under the
            MIT License.
          </Trans>
        </Setting.Description>
        <Setting.Description>
          <Trans>
            The root LICENSE and NOTICE.md retain the upstream license and
            acknowledgement.
          </Trans>
        </Setting.Description>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="globe" size={16} />
            <Trans>Contributors</Trans>
          </span>
        </Setting.Title>
        <Setting.Description>
          <Trans>
            YifuMusic is maintained by{' '}
            <ExternalLink
              href="https://github.com/yifulin114514143/YifuMusic/graphs/contributors"
              type="url"
            >
              project contributors
            </ExternalLink>
          </Trans>
          .
        </Setting.Description>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="fileText" size={16} />
            <Trans>Report issue / Ask for a feature</Trans>
          </span>
        </Setting.Title>
        <Setting.Description>
          <Trans>
            Bugs happen. Please, do not hesitate to report them or to ask for
            features you would like to see, using the{' '}
            <ExternalLink
              href="https://github.com/yifulin114514143/YifuMusic/issues"
              type="url"
            >
              issue tracker
            </ExternalLink>
            .
          </Trans>
        </Setting.Description>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="settings" size={16} />
            <Trans>Internals</Trans>
          </span>
        </Setting.Title>
        <Setting.Description>Tauri {tauriVersion}</Setting.Description>
        <Flexbox gap={4}>
          <ExternalButton href={appStorageDir} type="filedir">
            {t`Open storage directory`}
          </ExternalButton>
        </Flexbox>
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
