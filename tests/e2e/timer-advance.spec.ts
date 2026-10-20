import { expect, test } from '@playwright/test';
import { lobbyPlayer } from './players';

// A real phase ending: a 1-minute focus runs out and both screens move on to
// the short break together. Slow (about 80 s) because 1 minute is the
// shortest phase the database allows.
test('a finished focus phase rolls into a break for everyone', async ({ browser }) => {
  test.setTimeout(150_000);
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
  await owner.getByRole('button', { name: 'Start' }).click();

  // Wait out the minute, then both should be in a running short break.
  for (const page of [owner, guest]) {
    await expect(page.locator('.timer-panel')).toContainText('Short break', { timeout: 75_000 });
    await expect(page.locator('.timer-dots span.on')).toHaveCount(1);
  }
  await expect(guest.getByTestId('timer-clock')).not.toHaveText('05:00'); // counting down, not waiting
  await expect(guest.locator('.timer-panel')).not.toContainText('paused');
  const clocks = await Promise.all([owner, guest].map((p) => p.getByTestId('timer-clock').textContent()));
  const [a, b] = clocks.map((c) => {
    const [m, s] = c!.split(':').map(Number);
    return m * 60 + s;
  });
  expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
});
