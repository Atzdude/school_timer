const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appUrl = pathToFileURL(path.join(__dirname, '..', '..', 'timer_fixed_v2.html')).toString();

test.beforeEach(async ({ page }) => {
  await page.goto(appUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function addTimer(page, name, duration = '1h') {
  await page.locator('#timerName').fill(name);
  await page.locator('#timerDuration').fill(duration);
  await page.locator('#addTimerBtn').click();
}

test('hall mode hides setup and action controls while keeping timers readable', async ({ page }) => {
  await addTimer(page, 'Mathematics Paper 1 Extended Hall Visibility Name', '2h');
  await page.locator('#timerSizePreset').selectOption('hall');
  await page.locator('#visibilityToggle').click();

  await expect(page.locator('body')).toHaveClass(/presentation-mode/);
  await expect(page.locator('.controls-section')).toBeHidden();
  await expect(page.locator('.sessions-section')).toBeHidden();
  await expect(page.locator('.action-buttons')).toBeHidden();
  await expect(page.locator('.timer-controls')).toBeHidden();
  await expect(page.locator('.timer-display')).toHaveText('02:00:00');

  const timerBox = await page.locator('.timer-box').boundingBox();
  const display = await page.locator('.timer-display').boundingBox();
  expect(timerBox.width).toBeGreaterThan(900);
  expect(display.height).toBeGreaterThan(250);
});

test('controls support bulk add, lock, undo delete, and zoom presets', async ({ page }) => {
  await page.locator('#timerDuration').fill('45m');
  await page.locator('#bulkAddBtn').click();
  await page.locator('#bulkAddText').fill('Biology Paper 2, 1h30m\nPhysics Paper 3');
  await page.locator('#bulkAddSave').click();

  await expect(page.locator('.timer-box')).toHaveCount(2);
  await expect(page.locator('.timer-display').first()).toHaveText('01:30:00');
  await expect(page.locator('.timer-display').nth(1)).toHaveText('00:45:00');

  await page.locator('#timerSizePreset').selectOption('compact');
  await expect(page.locator('#zoomResetBtn')).toHaveText('72%');
  await page.locator('#zoomInBtn').click();
  await expect(page.locator('#timerSizePreset')).toHaveValue('custom');

  await page.locator('#controlLockToggle').click();
  await expect(page.locator('body')).toHaveClass(/controls-locked/);
  await expect(page.locator('.timer-edit-toggle').first()).toBeHidden();
  await page.locator('#controlLockToggle').click();

  await page.locator('.timer-edit-toggle').first().click();
  await page.locator('.timer-btn.delete').first().click();
  await page.locator('#confirmModalOk').click();
  await expect(page.locator('.timer-box')).toHaveCount(1);
  await page.locator('#undoDeleteBtn').click();
  await expect(page.locator('.timer-box')).toHaveCount(2);
});
