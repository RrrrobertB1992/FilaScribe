import { test, expect, chip, fold, goCreate, settingsCard } from './nfc.js';

// Settings → Appearance → Opening a card
const open = (page, id) => expect(fold(page, id)).toHaveJSProperty('open', true);
const shut = (page, id) => expect(fold(page, id)).toHaveJSProperty('open', false);
// At the top of the screen, or as high as the page can scroll
const atTop = (page, id) =>
  expect
    .poll(async () => {
      const y = (await fold(page, id).boundingBox()).y;
      const atEnd = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
      return y < 24 || atEnd;
    })
    .toBe(true);
const closeOthers = async (page) => {
  const card = await settingsCard(page, 'Appearance');
  await card.getByRole('button', { name: 'Close the others' }).click();
};

test.describe('Opening a card', () => {
  test('Leave the others is the default: every card stays as you set it', async ({ page }) => {
    await expect((await settingsCard(page, 'Appearance')).getByRole('button', { name: 'Leave the others' })).toHaveAttribute('aria-pressed', 'true');
    await goCreate(page); // the test setup starts every card open
    await fold(page, 'temps').locator('summary').click();
    await shut(page, 'temps');
    await fold(page, 'temps').locator('summary').click();
    await open(page, 'temps');
    await open(page, 'filament');
    await open(page, 'colors');
  });

  test('Close the others: opening a card closes the rest and brings it to the top, and it is remembered', async ({ page }) => {
    await closeOthers(page);
    await goCreate(page);
    await open(page, 'filament');
    await fold(page, 'temps').locator('summary').click(); // shuts it, and nothing else closes
    await shut(page, 'temps');
    await open(page, 'filament');
    await fold(page, 'temps').locator('summary').click(); // opens it: the rest close
    await open(page, 'temps');
    await shut(page, 'filament');
    await atTop(page, 'temps');
    await fold(page, 'colors').locator('summary').click();
    await open(page, 'colors');
    await shut(page, 'temps');
    await atTop(page, 'colors');
    // the cards that were closed for you stay closed, and the choice is kept
    await page.reload();
    await open(page, 'colors');
    await shut(page, 'filament');
    await shut(page, 'temps');
    await expect((await settingsCard(page, 'Appearance')).getByRole('button', { name: 'Close the others' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Close the others also applies to the cards in Settings', async ({ page }) => {
    await closeOthers(page);
    await settingsCard(page, 'About');
    await expect(page.locator('details.card', { has: page.getByRole('heading', { name: 'About', exact: true }) })).toHaveJSProperty('open', true);
    await expect(page.locator('details.card', { has: page.getByRole('heading', { name: 'Appearance', exact: true }) })).toHaveJSProperty('open', false);
  });
});
