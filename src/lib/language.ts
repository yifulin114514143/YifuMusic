import { ALL_LANGUAGES, DEFAULT_LANGUAGE } from '../translations/languages';

const SUPPORTED_LANGUAGE_CODES = new Set(
  ALL_LANGUAGES.map((language) => language.code),
);

export function normalizeLanguage(language: string): string {
  const normalized = language.trim();

  return SUPPORTED_LANGUAGE_CODES.has(normalized)
    ? normalized
    : DEFAULT_LANGUAGE.code;
}
