import { defineConfig } from '@lingui/cli';

import { ALL_LANGUAGES } from './src/translations/languages';

// 运行时默认语言由 Rust Config 和语言菜单决定。Lingui 源消息仍使用英语
// msgid，因此不能把运行时的 zh-CN 默认值作为 sourceLocale，否则提取时会
// 覆盖已有的中文翻译。
const SOURCE_LOCALE = 'en';

/**
 * Lingui Config - https://lingui.dev/ref/conf
 */
export default defineConfig({
  sourceLocale: SOURCE_LOCALE,
  fallbackLocales: {
    default: SOURCE_LOCALE,
  },
  locales: ALL_LANGUAGES.map((l) => l.code),
  catalogs: [
    {
      name: 'main',
      path: '<rootDir>/src/translations/{locale}',
      include: ['src'],
      exclude: ['src/**/__screenshots__/**'],
    },
  ],
  orderBy: 'origin',
});
