import { Trans, useLingui } from '@lingui/react/macro';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useLoaderData } from '@tanstack/react-router';

import SettingsAPI from '../api/SettingsAPI';
import * as Setting from '../components/Setting';
import CheckboxSetting from '../components/SettingCheckbox';
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
      <Setting.Section>
        <Setting.Title>
          <Trans>About YifuMusic</Trans>
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
        <CheckboxSetting
          title={t`Automatically check for updates`}
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
          <Trans>Contributors</Trans>
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
          <Trans>Report issue / Ask for a feature</Trans>
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
          <Trans>Internals</Trans>
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
