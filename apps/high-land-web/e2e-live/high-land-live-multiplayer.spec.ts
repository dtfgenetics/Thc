import { expect, test, type Page } from '@playwright/test';

const credentialKey = 'high-land-room-credential-v1';

async function forceNextDiceRoll(page: Page, roll: 1 | 2 | 3 | 4 | 5 | 6): Promise<void> {
  await page.evaluate((value) => {
    const url = new URL(window.location.href);
    url.searchParams.set('hlTestRoll', String(value));
    window.history.replaceState({}, '', url);
  }, roll);
}

async function browserCredential(page: Page): Promise<string> {
  return page.evaluate((key) => window.localStorage.getItem(key) ?? '', credentialKey);
}

test.describe('High Land live multiplayer acceptance', () => {
  test('two isolated browsers can join, synchronize turns, and reconnect securely', async ({ browser }) => {
    test.slow();

    const suffix = Date.now().toString(36).slice(-6);
    const hostName = `Live Host ${suffix}`;
    const guestName = `Live Guest ${suffix}`;
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await host.goto(`/games/high-land/?dtf_live_multiplayer=${suffix}`, { waitUntil: 'domcontentloaded' });
      await expect(host.getByRole('heading', { name: 'High Land: The Sweet Escape' })).toBeVisible();

      await host.getByRole('button', { name: 'Create Room' }).click();
      await host.getByPlaceholder('Enter your player name').fill(hostName);
      await host.getByRole('button', { name: 'Create Room' }).click();

      const hostLobby = host.getByLabel('High Land room lobby');
      await expect(hostLobby).toBeVisible();
      const inviteUrl = await host.getByLabel('Invite link').inputValue();
      const roomCode = new URL(inviteUrl).searchParams.get('game');
      expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
      await expect(host.getByRole('button', { name: 'Start Game' })).toBeDisabled();

      const hostCredential = await browserCredential(host);
      expect(hostCredential).toMatch(/^[a-f0-9]{64}$/i);

      await guest.goto(inviteUrl, { waitUntil: 'domcontentloaded' });
      await expect(guest.getByRole('heading', { name: 'Join a High Land room' })).toBeVisible();
      await expect(guest.getByPlaceholder('Room code')).toHaveValue(roomCode ?? '');
      await guest.getByPlaceholder('Enter your player name').fill(guestName);
      await guest.getByRole('button', { name: 'Join Room' }).click();

      const guestLobby = guest.getByLabel('High Land room lobby');
      await expect(guestLobby).toBeVisible();
      await expect(guestLobby.getByText(guestName)).toBeVisible();
      await expect(guest.getByText('Only the host can start the room.')).toBeVisible();
      await expect(guest.getByRole('button', { name: 'Start Game' })).toBeDisabled();

      const guestCredential = await browserCredential(guest);
      expect(guestCredential).toMatch(/^[a-f0-9]{64}$/i);
      expect(guestCredential).not.toBe(hostCredential);

      await expect(hostLobby.getByText(guestName)).toBeVisible({ timeout: 20_000 });
      const hostStart = host.getByRole('button', { name: 'Start Game' });
      await expect(hostStart).toBeEnabled();
      await hostStart.click();

      const hostRoll = host.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' });
      const guestRoll = guest.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' });
      await expect(hostRoll).toBeVisible();
      await expect(hostRoll).toBeEnabled();
      await expect(guestRoll).toBeVisible({ timeout: 20_000 });
      await expect(guestRoll).toBeDisabled();

      await forceNextDiceRoll(host, 1);
      await hostRoll.click();

      await expect(guestRoll).toBeEnabled({ timeout: 20_000 });
      await expect(hostRoll).toBeDisabled();
      const hostChipOnGuest = guest.locator('.player-chip').filter({ hasText: hostName });
      await expect(hostChipOnGuest).toContainText('Space 2 of 109');

      await forceNextDiceRoll(guest, 1);
      await guestRoll.click();

      await expect(hostRoll).toBeEnabled({ timeout: 20_000 });
      await expect(guestRoll).toBeDisabled();
      const guestChipOnHost = host.locator('.player-chip').filter({ hasText: guestName });
      await expect(guestChipOnHost).toContainText('Space 2 of 109');

      await guest.reload({ waitUntil: 'domcontentloaded' });
      await expect(guest.getByRole('heading', { name: 'High Land: The Sweet Escape' })).toBeVisible();
      await expect(guest.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' })).toBeVisible({ timeout: 20_000 });
      await expect(guest.locator('.player-chip').filter({ hasText: hostName })).toContainText('Space 2 of 109');
      await expect(guest.locator('.player-chip').filter({ hasText: guestName })).toContainText('Space 2 of 109');
      await expect(guest.locator('.board-controls-card').getByRole('button', { name: 'Roll Dice' })).toBeDisabled();

      expect(await browserCredential(guest)).toBe(guestCredential);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});
