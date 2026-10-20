import { expect, test, type Page } from '@playwright/test';
import { lobbyPlayer } from './players';

// The full loop on a real (1-minute) focus round: both set goals, the round
// runs out and rolls into a break for everyone, both check in, seeds land in
// the shared jar, and the guest spends them building something. Slow (about
// 90 s) because 1 minute is the shortest round the database allows.
test('a finished round pays seeds into the jar, which buy things to build', async ({ browser }) => {
  test.setTimeout(180_000);
  const { page: owner } = await lobbyPlayer(browser, 'E2E Owner', 'Cat');
  const { page: guest } = await lobbyPlayer(browser, 'E2E Guest', 'Panda');

  await owner.getByRole('button', { name: 'Create a room' }).click();
  await expect(owner.getByTestId('room-code')).toHaveText(/^[A-HJ-NP-Z]{4}$/);
  const code = (await owner.getByTestId('room-code').textContent())!.trim();
  await guest.getByLabel('Room code').fill(code);
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(owner.locator('.members li.online')).toHaveCount(2);

  await owner.getByRole('button', { name: 'Timer settings' }).click();
  await owner.getByRole('spinbutton', { name: /Focus/ }).fill('1');
  await owner.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(guest.getByTestId('timer-clock')).toHaveText('01:00');

  // Goals: the owner picks one of their to-dos, the guest types one.
  await owner.getByLabel('New task').fill('Read chapter 4');
  await owner.getByLabel('New task').press('Enter');
  await owner.getByRole('button', { name: 'Read chapter 4', exact: true }).click();
  await expect(owner.getByTestId('my-goal')).toContainText('Read chapter 4');
  await guest.getByLabel('Goal for this round', { exact: true }).fill('Flashcards');
  await guest.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(guest.getByTestId('my-goal')).toContainText('Flashcards');
  // Each sees the other's goal above their animal.
  await expect(owner.locator('.goal-bubble', { hasText: 'Flashcards' })).toBeVisible();
  await expect(guest.locator('.goal-bubble', { hasText: 'Read chapter 4' })).toBeVisible();

  await owner.getByRole('button', { name: 'Start' }).click();

  // The round ends for both: a break starts and each is asked how it went.
  for (const page of [owner, guest]) {
    await expect(page.locator('.timer-panel')).toContainText('Short break', { timeout: 75_000 });
    await expect(page.getByText('Round done!')).toBeVisible();
  }
  // 1 minute × 1.5 (two of you) = 2 seeds each, 4 in the jar.
  for (const page of [owner, guest]) await expect(page.getByTestId('seed-count')).toHaveText('🌱 4');

  // Both finished: +5 each, and the owner's linked to-do gets ticked.
  for (const page of [owner, guest]) await page.getByRole('button', { name: /Done/ }).click();
  for (const page of [owner, guest]) await expect(page.getByTestId('seed-count')).toHaveText('🌱 14');
  await expect(owner.getByRole('checkbox', { name: 'Read chapter 4' })).toBeChecked();

  // The guest spends 10 on a flower patch; the owner's jar drops too.
  await guest.getByRole('button', { name: '🔨 Build' }).click();
  await guest.getByRole('button', { name: /Flower patch/ }).click();
  await tapUntilItFits(guest);
  await guest.getByRole('button', { name: 'Place', exact: true }).click();
  await expect(guest.getByRole('button', { name: /Flower patch/ })).toBeVisible(); // back in the shop
  await expect(owner.getByTestId('seed-count')).toHaveText('🌱 4');
  await expect(guest.getByRole('button', { name: /Bush/ })).toBeDisabled(); // 15 > 4
});

/** Taps around the middle of the island until the build preview fits. */
async function tapUntilItFits(page: Page) {
  const box = (await page.locator('canvas').first().boundingBox())!;
  const spots = [
    [0.5, 0.72],
    [0.4, 0.75],
    [0.6, 0.75],
    [0.45, 0.62],
    [0.55, 0.85],
    [0.35, 0.65],
  ];
  for (const [fx, fy] of spots) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    if (await page.getByRole('button', { name: 'Place', exact: true }).isEnabled()) return;
  }
  throw new Error('no spot to place it');
}
