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
