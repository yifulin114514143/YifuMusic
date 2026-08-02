import { i18n } from '@lingui/core';

export const I18N_CHANGE_EVENT = 'yifumusic:i18n-change';

export async function loadTranslation(language: string) {
  const { messages } = await import(`../translations/${language}.po`);

  i18n.load(language, messages);
  i18n.activate(language);
  window.dispatchEvent(new Event(I18N_CHANGE_EVENT));
}
