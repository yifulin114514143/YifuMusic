import { t as tMacro } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import * as stylex from '@stylexjs/stylex';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { relaunch } from '@tauri-apps/plugin-process';
import { debounce } from 'lodash-es';
import { useMemo } from 'react';

import SettingsAPI, { DEFAULT_MAIN_COLOR } from '../api/SettingsAPI';
import { useAppShell } from '../components/AppShellContext';
import DesktopLyricsButton from '../components/DesktopLyricsButton';
import Icon from '../components/Icon';
import * as Setting from '../components/Setting';
import Button from '../elements/Button';
import type { Config, DefaultView } from '../generated/typings';
import useInvalidate, { useInvalidateCallback } from '../hooks/useInvalidate';
import ConfigBridge from '../lib/bridge-config';
import SettingsBridge from '../lib/bridge-settings';
import { configQuery } from '../lib/queries';
import { themes } from '../lib/themes';
import { logAndNotifyError } from '../lib/utils';
import {
  DEFAULT_LANGUAGE,
  NON_DEFAULT_LANGUAGES,
} from '../translations/languages';

export const Route = createFileRoute('/settings/ui')({
  component: ViewSettingsUI,
});

function ViewSettingsUI() {
  const config = useSuspenseQuery(configQuery).data;
  const { t } = useLingui();
  const { navigationMode, toggleNavigationMode } = useAppShell();

  const invalidate = useInvalidate();

  const setUIMainColorThrottled = useMemo(() => {
    return debounce((value: string) => {
      SettingsAPI.setUIMainColor(value)
        .then(invalidate)
        .catch(logAndNotifyError);
    }, 250);
  }, [invalidate]);
  const setStatusBarLyrics = useInvalidateCallback((value: boolean) =>
    ConfigBridge.set('status_bar_lyrics', value),
  );
  const setLiquidGlass = useInvalidateCallback((value: boolean) =>
    ConfigBridge.set('liquid_glass', value),
  );
  const setDynamicEffects = useInvalidateCallback((value: boolean) =>
    ConfigBridge.set('dynamic_effects', value),
  );
  const setDiscoverCharacterVisible = useInvalidateCallback((value: boolean) =>
    ConfigBridge.set('discover_character_visible', value),
  );

  return (
    <>
      <Setting.PageHeader
        title={t`Interface`}
        description={t`Change the appearance of the interface`}
      />
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="settings" size={16} />
            主题与外观
          </span>
        </Setting.Title>
        <Setting.Select
          label={t`Theme`}
          description={t`Change the appearance of the interface`}
          value={config.theme}
          onChange={(e) =>
            SettingsAPI.setTheme(e.currentTarget.value)
              .then(invalidate)
              .catch(logAndNotifyError)
          }
        >
          <option value="__system">{t`System (default)`}</option>
          {Object.values(themes).map((theme) => {
            return (
              <option key={theme._id} value={theme._id}>
                {getTranslatedThemeName(theme.name)}
              </option>
            );
          })}
        </Setting.Select>
        <Setting.Toggle
          title="液态玻璃效果"
          description="使用毛玻璃表面与背景折射效果"
          value={config.liquid_glass}
          onChange={setLiquidGlass}
        />
        <Setting.Toggle
          title="动态效果"
          description="启用播放指示、悬浮反馈与页面过渡"
          value={config.dynamic_effects}
          onChange={setDynamicEffects}
        />
        <Setting.Toggle
          title="发现页角色图"
          description="在发现页分类栏显示南宫羽视觉素材"
          value={config.discover_character_visible}
          onChange={setDiscoverCharacterVisible}
        />
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="list" size={16} />
            导航布局
          </span>
        </Setting.Title>
        <Setting.Select
          label="导航方式"
          description="在顶部导航与侧栏导航之间切换"
          value={navigationMode}
          onChange={(event) => {
            if (event.currentTarget.value !== navigationMode) {
              toggleNavigationMode();
            }
          }}
        >
          <option value="top">顶部</option>
          <option value="side">侧栏</option>
        </Setting.Select>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="settings" size={16} />
            主色调
          </span>
        </Setting.Title>
        <Setting.ColorSelector
          label={t`Accent color`}
          value={config.ui_accent_color ?? DEFAULT_MAIN_COLOR}
          description={
            <Button
              type="button"
              bSize="small"
              onClick={() => {
                SettingsAPI.setUIMainColor(DEFAULT_MAIN_COLOR)
                  .then(invalidate)
                  .catch(logAndNotifyError);
                SettingsAPI.applyUIMainColorToUI(DEFAULT_MAIN_COLOR);
              }}
            >{t`Reset`}</Button>
          }
          onChange={(e) => {
            const value = e.currentTarget.value;
            SettingsAPI.applyUIMainColorToUI(value);
            setUIMainColorThrottled(value);
          }}
        />
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="globe" size={16} />
            语言
          </span>
        </Setting.Title>
        <Setting.Select
          label={t`Language`}
          description={t`Choose the language used by YifuMusic`}
          value={config.language}
          onChange={(e) => {
            SettingsAPI.setLanguage(e.target.value)
              .then(invalidate)
              .catch(logAndNotifyError);
          }}
        >
          <option value={DEFAULT_LANGUAGE.code}>
            {DEFAULT_LANGUAGE.label}
          </option>
          <option disabled>──────────</option>
          {NON_DEFAULT_LANGUAGES.map((language) => {
            return (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            );
          })}
        </Setting.Select>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="list" size={16} />
            曲目列表
          </span>
        </Setting.Title>
        <Setting.Select
          label={t`Tracks density`}
          description={t`Change the tracks spacing`}
          value={config.track_view_density}
          onChange={(e) =>
            SettingsAPI.setTracksDensity(
              e.currentTarget.value as Config['track_view_density'],
            )
              .then(invalidate)
              .catch(logAndNotifyError)
          }
        >
          <option value="normal">
            <Trans>Normal (default)</Trans>
          </option>
          <option value="compact">
            <Trans>Compact</Trans>
          </option>
        </Setting.Select>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="house" size={16} />
            启动页
          </span>
        </Setting.Title>
        <Setting.Select
          label={t`Default view`}
          value={config.default_view}
          description={t`Change the default view when starting the application`}
          onChange={(e) =>
            SettingsBridge.setDefaultView(e.currentTarget.value as DefaultView)
              .then(invalidate)
              .catch(logAndNotifyError)
          }
        >
          <option value="Library">
            <Trans>Library (default)</Trans>
          </option>
          <option value="Artists">
            <Trans>Artists</Trans>
          </option>
          <option value="Playlists">
            <Trans>Playlists</Trans>
          </option>
        </Setting.Select>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="musicalNotes" size={16} />
            播放行为
          </span>
        </Setting.Title>
        <Setting.Toggle
          title={t`Sleep mode blocker`}
          description={t`Prevent the computer from going into sleep mode when playing`}
          value={config.sleepblocker}
          onChange={useInvalidateCallback((value: boolean) =>
            SettingsBridge.toggleSleepBlocker(value),
          )}
        />
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="musicalNotes" size={16} />
            桌面歌词
          </span>
        </Setting.Title>
        <Setting.Description>
          在独立窗口显示当前本地歌词，并继续复用现有桌面歌词 bridge。
        </Setting.Description>
        <div {...stylex.props(styles.desktopLyricsAction)}>
          <DesktopLyricsButton />
          <span>打开后可在桌面歌词窗口调整颜色、字号与锁定状态。</span>
        </div>
      </Setting.Section>
      <Setting.Section>
        <Setting.Title>
          <span {...stylex.props(styles.cardTitle)}>
            <Icon name="globe" size={16} />
            在线服务与扩展
          </span>
        </Setting.Title>
        <Setting.Description>
          账号、在线服务、代理、插件和 PWA
          没有已验证的服务契约，因此保持不可用。
        </Setting.Description>
        <button
          aria-label="在线服务、账号、代理、插件和 PWA 服务接入后可用"
          disabled
          title="服务接入后可用"
          type="button"
          {...stylex.props(styles.unavailableService)}
        >
          服务接入后可用
        </button>
      </Setting.Section>
      {window.__MUSEEKS_PLATFORM === 'macos' && (
        <Setting.Section>
          <Setting.Title>
            <span {...stylex.props(styles.cardTitle)}>
              <Icon name="musicalNotes" size={16} />
              状态栏歌词
            </span>
          </Setting.Title>
          <Setting.Toggle
            title={t`状态栏歌词`}
            description={t`在 macOS 菜单栏显示当前本地歌词`}
            value={config.status_bar_lyrics}
            onChange={setStatusBarLyrics}
          />
        </Setting.Section>
      )}
      {window.__MUSEEKS_PLATFORM === 'linux' && (
        <Setting.Section>
          <Setting.Title>
            <span {...stylex.props(styles.cardTitle)}>
              <Icon name="settings" size={16} />
              Wayland 兼容性
            </span>
          </Setting.Title>
          <Setting.Toggle
            title={t`[Beta] Wayland compatibility enhancements`}
            description={t`If you face issues using Wayland, try out this option`}
            value={config.wayland_compat}
            onChange={() =>
              SettingsBridge.toggleWaylandCompat(!config.wayland_compat).then(
                async () => {
                  await invalidate();
                  await relaunch();
                },
              )
            }
          />
        </Setting.Section>
      )}
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
  desktopLyricsAction: {
    minHeight: '38px',
    display: 'flex',
    alignItems: 'center',
    columnGap: '10px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  unavailableService: {
    minHeight: '38px',
    paddingBlock: '8px',
    paddingInline: '12px',
    alignSelf: 'flex-start',
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--surface-sunken)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'not-allowed',
    opacity: 0.72,
  },
});

/**
 * Get the theme name in the current language
 */
export function getTranslatedThemeName(themeName: string) {
  switch (themeName) {
    case 'Light':
      return tMacro`Light`;
    case 'Dark':
      return tMacro`Dark`;
  }

  return themeName;
}
