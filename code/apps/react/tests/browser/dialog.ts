import { expect, type Page } from '@playwright/test';

/** Negative assertions can already be true before React's blocker effect runs. */
export async function respondToDialog(page: Page, response: 'accept' | 'dismiss', action: () => Promise<unknown>, type = 'confirm') {
  const handled = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.type()).toBe(type);
    await dialog[response]();
  });
  await Promise.all([handled, action()]);
}
