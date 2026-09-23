const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appUrl = pathToFileURL(path.join(__dirname, '..', '..', 'app', 'index.html')).toString();

test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'no-preference' } });

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
});

async function addTimer(page, name, duration = '1h') {
  await page.locator('#timerName').fill(name);
  await page.locator('#timerDuration').fill(duration);
  await page.locator('#addTimerBtn').click();
}

// After any animated change the cards must be left clean: no inline layout styles, fully opaque.
async function expectSettled(page) {
  await expect.poll(() => page.evaluate(() =>
    Array.from(document.querySelectorAll('.timer-box')).filter(b => b.hasAttribute('style') || getComputedStyle(b).opacity !== '1' || getComputedStyle(b).position === 'absolute').length
  ), { timeout: 3000 }).toBe(0);
}

test('anime.js is loaded from the local vendor copy', async ({ page }) => {
  const info = await page.evaluate(() => ({ type: typeof anime, layout: typeof anime.createLayout }));
  expect(info).toEqual({ type: 'object', layout: 'function' });
});

test('adding exams animates in and settles cleanly', async ({ page }) => {
  await addTimer(page, 'Biology Paper 2', '1h30m');
  await addTimer(page, 'Chemistry Paper 1');
  await addTimer(page, 'Physics Paper 3');
  await expect(page.locator('.timer-box')).toHaveCount(3);
  await expectSettled(page);
});

test('deleting an exam animates out, then removes the card', async ({ page }) => {
  await addTimer(page, 'Keep me');
  await addTimer(page, 'Delete me');
  await expectSettled(page);
  await page.locator('.timer-edit-toggle').nth(1).click();
  await page.locator('.timer-btn.delete').nth(1).click();
  await page.locator('#confirmModalOk').click();
  await expect(page.locator('.timer-box')).toHaveCount(1);
  await expect(page.locator('.timer-name')).toHaveText(['Keep me']);
  await expectSettled(page);
});

test('moving an exam keeps DOM order and data order in sync', async ({ page }) => {
  await addTimer(page, 'First');
  await addTimer(page, 'Second');
  await expectSettled(page);
  await page.locator('.timer-edit-toggle').nth(1).click();
  await page.locator('.timer-btn.move-up').nth(1).click();
  await expectSettled(page);
  await expect(page.locator('.timer-name')).toHaveText(['Second', 'First']);
  const dataOrder = await page.evaluate(() => timers.map(t => t.name));
  expect(dataOrder).toEqual(['Second', 'First']);
});

test('buttons visibly give when pressed', async ({ page }) => {
  const button = page.locator('#startAllBtn');
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const pressed = await button.evaluate(el => getComputedStyle(el).transform);
  await page.mouse.up();
  expect(pressed).not.toBe('none');
});

test('time up is a steady colour, never flashing', async ({ page }) => {
  await addTimer(page, 'Ending');
  await page.evaluate(() => completeTimer(timers[0]));
  const anim = await page.locator('.timer-display').evaluate(el => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await expect(page.locator('.timer-status')).toHaveText('Time up');
});
