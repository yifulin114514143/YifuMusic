import { expect, test } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser';

import { beforeEachSetup, getMainNavigation } from './e2e-helpers';

beforeEachSetup();

test('The language selector should update the UI', async () => {
  await getMainNavigation().getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Interface' }).click();
  await page
    .getByRole('combobox', { name: 'Language' })
    .selectOptions('Français (French)');

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Bibliothèque' })
    .click();
  await expect
    .element(page.getByRole('heading', { level: 1 }))
    .toHaveTextContent('Bibliothèque');
});

test('The Chinese locale exposes Chinese navigation names and tooltips', async () => {
  await getMainNavigation().getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Interface' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOptions('zh-CN');

  const navigation = page.getByRole('navigation', { name: '主导航' });

  for (const label of ['音乐库', '艺术家', '播放列表', '设置']) {
    const link = navigation.getByRole('link', { name: label, exact: true });

    await expect.element(link).toHaveAttribute('aria-label', label);
    await expect.element(link).toHaveAttribute('title', label);
  }

  const iconButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[data-museeks-action]'),
  );

  expect(iconButtons.length).toBeGreaterThan(0);

  for (const button of iconButtons) {
    const label = button.getAttribute('aria-label') ?? '';

    expect(label).not.toBe('');
    expect(button.getAttribute('title')).toBe(label);
    expect(label).not.toMatch(/[A-Za-z]/);
  }
});
