import { expect, test } from '@playwright/test';
import { lobbyPlayer } from './players';

test('owner creates a room, guest joins by code, both see each other', async ({ browser }) => {
  const { page: owner, save: saveOwner } = await lobbyPlayer(browser, 'E2E Owner', 'Cat');
  const { page: guest, save: saveGuest } = await lobbyPlayer(browser, 'E2E Guest', 'Panda');

  await owner.getByRole('button', { name: 'Create a room' }).click();
  await expect(owner.getByTestId('room-code')).toHaveText(/^[A-HJ-NP-Z]{4}$/);
  const code = (await owner.getByTestId('room-code').textContent())!.trim();

  // A wrong code shows an error and stays in the lobby.
  await guest.getByLabel('Room code').fill(code === 'ZZZZ' ? 'YYYY' : 'ZZZZ');
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(guest.getByText('no room with that code')).toBeVisible();

  // Lowercase works too.
  await guest.getByLabel('Room code').fill(code.toLowerCase());
  await guest.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(guest.getByTestId('room-code')).toHaveText(code);

  // Both lists update live, and the owner is marked.
  await expect(owner.getByTestId('member-count')).toHaveText('2');
  await expect(guest.getByTestId('member-count')).toHaveText('2');
  await expect(guest.locator('.members li', { hasText: 'E2E Owner' })).toContainText('owner');
  await expect(owner.locator('.members li', { hasText: 'E2E Owner' })).toContainText('(you)');

  // Both show as online.
  await expect(owner.locator('.members li.online')).toHaveCount(2);
  await expect(guest.locator('.members li.online')).toHaveCount(2);

  // The guest restyles their avatar; the owner's list updates live.
  const guestRowOnOwner = owner.locator('.members li', { hasText: 'E2E Guest' });
  async function guestBecomes(animal: string, emoji: string) {
    await guest.getByRole('button', { name: 'Edit avatar' }).click();
    await guest.getByRole('button', { name: animal }).click();
    await guest.getByRole('button', { name: 'Mint' }).click();
    await guest.getByRole('button', { name: 'Save' }).click();
    await expect(guest.getByRole('button', { name: 'Save' })).toBeHidden();
    await expect(guestRowOnOwner).toContainText(emoji);
  }
  await guestBecomes('Koala', '🐨');
  await guestBecomes('Panda', '🐼'); // back again, so the next run starts the same

  // To-dos: the owner's list shows up live (read-only) for the guest.
  const ownerListOnGuest = guest.locator('section[data-member="E2E Owner"]');
  const task = `Read chapter ${Date.now() % 1000}`;
  await owner.getByLabel('New task').fill(task);
  await owner.getByLabel('New task').press('Enter');
  await expect(ownerListOnGuest.getByText(task)).toBeVisible();
  await expect(ownerListOnGuest.getByRole('checkbox')).toHaveCount(0);
  await owner.getByRole('checkbox', { name: task }).check();
  await expect(ownerListOnGuest.locator('li.done', { hasText: task })).toBeVisible();
  await expect(ownerListOnGuest).toContainText('1/1');
  await owner.getByRole('button', { name: `Delete ${task}` }).click();
  await expect(ownerListOnGuest.getByText(task)).toHaveCount(0);

  // The owner hears where the guest's animal is...
  const guestOnOwnerScreen = () =>
    owner.evaluate(() => {
      const remotes = (window as unknown as { __togethrRemotes?: Map<string, { simX: number; simZ: number }> })
        .__togethrRemotes;
      const r = remotes && [...remotes.values()][0];
      return r ? [r.simX, r.simZ] : null;
    });
  await expect.poll(guestOnOwnerScreen).not.toBeNull();
  const before = (await guestOnOwnerScreen())!;

  // ...and sees it walk after the guest taps somewhere.
  const box = (await guest.locator('canvas').boundingBox())!;
  await guest.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.78);
  await expect
    .poll(async () => {
      const now = await guestOnOwnerScreen();
      return now ? Math.hypot(now[0] - before[0], now[1] - before[1]) : 0;
    })
    .toBeGreaterThan(0.5);

  // Refreshing keeps you in the room.
  await guest.reload();
  await expect(guest.getByTestId('room-code')).toHaveText(code);

  // Guest leaves; the owner's list drops back to 1.
  await guest.getByRole('button', { name: 'Leave room' }).click();
  await expect(guest.getByRole('button', { name: 'Create a room' })).toBeVisible();
  await expect(owner.getByTestId('member-count')).toHaveText('1');

  // The owner can return to the lobby and rejoin from "Your rooms".
  await owner.getByRole('button', { name: 'Back to lobby' }).click();
  await owner.getByRole('button', { name: new RegExp(code) }).click();
  await expect(owner.getByTestId('room-code')).toHaveText(code);

  // Keep refreshed tokens for the next run.
  await saveOwner();
  await saveGuest();
});
