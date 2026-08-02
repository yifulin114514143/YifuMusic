/**
 * Components helpers
 */

import { Trans, useLingui } from '@lingui/react/macro';
import { type ErrorComponentProps, useLocation } from '@tanstack/react-router';
import * as logger from '@tauri-apps/plugin-log';

import ExternalLink from '../elements/ExternalLink';
import Link from '../elements/Link';
import * as ViewMessage from '../elements/ViewMessage';

export function ErrorView(props: ErrorComponentProps) {
  const error = props.error;
  let errorMessage: string;

  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    errorMessage = '未知错误';
  }

  logger.error(errorMessage);

  return (
    <ViewMessage.Notice>
      <p>
        <span role="img" aria-label="错误">
          💥
        </span>{' '}
        <Trans>Something wrong happened: {errorMessage}</Trans>
      </p>
      <Issue />
    </ViewMessage.Notice>
  );
}

export function NotFoundView() {
  const location = useLocation();
  const { t } = useLingui();

  return (
    <ViewMessage.Notice>
      <p>
        <span role="img" aria-label={t`how?`}>
          🤔
        </span>{' '}
        <Trans>
          View not found ({location.pathname}). How did you get here?
        </Trans>
      </p>
      <Issue />
    </ViewMessage.Notice>
  );
}

function Issue() {
  return (
    <ViewMessage.Sub>
      <Trans>
        Try{' '}
        <Link
          onClick={() => {
            window.location.assign(import.meta.env.BASE_URL);
          }}
        >
          reloading the app
        </Link>
        ,
      </Trans>
      <br />
      <Trans>
        or if it happens again, please{' '}
        <ExternalLink
          href="https://github.com/yifulin114514143/YifuMusic/issues"
          type="url"
        >
          report an issue
        </ExternalLink>
        .
      </Trans>
    </ViewMessage.Sub>
  );
}
