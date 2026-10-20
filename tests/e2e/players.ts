import { existsSync, mkdirSync } from 'node:fs';
import { expect, type Browser, type Page } from '@playwright/test';

// Supabase caps anonymous sign-ins per hour, so each test player's session is
// saved in tests/e2e/.auth/ and reused across runs instead of signing up anew.
const AUTH_DIR = 'tests/e2e/.auth';

export interface TestPlayer {
  page: Page;
  save: () => Promise<void>;
}

/** Opens the app as a reusable test player and leaves them in the lobby. */
export async function lobbyPlayer(browser: Browser, name: string, animal: string): Promise<TestPlayer> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const statePath = `${AUTH_DIR}/${name.replace(/\W+/g, '-').toLowerCase()}.json`;
  const context = await browser.newContext(existsSync(statePath) ? { storageState: statePath } : {});
  // Test players have seen the first-room tips (they'd sit over the island).
  await context.addInitScript(() => localStorage.setItem('togethr.tipsSeen', '1'));
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[${name}] ${msg.text()}`);
  });
  await page.goto('/');

  const nameField = page.getByLabel('Your name');
  const createButton = page.getByRole('button', { name: 'Create a room' });
  const leaveButton = page.getByRole('button', { name: /Leave room|Back to lobby/ });
  await expect(nameField.or(createButton).or(leaveButton)).toBeVisible({ timeout: 15_000 });

  if (await nameField.isVisible()) {
    await nameField.fill(name);
    await page.getByRole('button', { name: animal }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  } else if (await leaveButton.isVisible()) {
    await leaveButton.click();
  }
  await expect(createButton).toBeVisible();

  const save = async () => {
    await context.storageState({ path: statePath });
  };
  await save();
  return { page, save };
}
