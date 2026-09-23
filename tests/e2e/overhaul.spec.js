const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appUrl = pathToFileURL(path.join(__dirname, '..', '..', 'app', 'index.html')).toString();

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

test.describe('Duration parsing', () => {
  test('understands the ways teachers actually type durations', async ({ page }) => {
    const results = await page.evaluate(() => ({
      '2 hours': parseTimeString('2 hours'),
      '1.5h': parseTimeString('1.5h'),
      '2h 30min': parseTimeString('2h 30min'),
      '1 hr 15 mins': parseTimeString('1 hr 15 mins'),
      '90': parseTimeString('90'),
      '90 min': parseTimeString('90 min'),
      '1:30': parseTimeString('1:30'),
      '1:30:15': parseTimeString('1:30:15'),
      '45s': parseTimeString('45s')
    }));
    expect(results).toEqual({
      '2 hours': 7200,
      '1.5h': 5400,
      '2h 30min': 9000,
      '1 hr 15 mins': 4500,
      '90': 5400,
      '90 min': 5400,
      '1:30': 5400,
      '1:30:15': 5415,
      '45s': 45
    });
  });

  test('rejects input it cannot read instead of guessing', async ({ page }) => {
    const results = await page.evaluate(() => ['2 houses', 'two hours', '1:75', 'Paper 1', '2h banana'].map(parseTimeString));
    expect(results).toEqual([0, 0, 0, 0, 0]);
  });

  test('shows a clear error for an unreadable duration and adds nothing', async ({ page }) => {
    await addTimer(page, 'Biology', 'two hours');
    await expect(page.locator('#timerFormError')).toBeVisible();
    await expect(page.locator('#timerFormError')).toContainText('two hours');
    await expect(page.locator('.timer-box')).toHaveCount(0);
  });

  test('keeps the duration after adding so the next exam is quick', async ({ page }) => {
    await addTimer(page, 'Biology', '2h');
    await expect(page.locator('#timerDuration')).toHaveValue('2h');
    await expect(page.locator('#timerName')).toHaveValue('');
  });
});

test.describe('Time format', () => {
  test('drops the hours when under one hour', async ({ page }) => {
    await addTimer(page, 'Short', '45m');
    await addTimer(page, 'Long', '2h');
    await expect(page.locator('.timer-display').nth(0)).toHaveText('45:00');
    await expect(page.locator('.timer-display').nth(1)).toHaveText('2:00:00');
  });
});

test.describe('Bulk add', () => {
  test('names may contain commas; duration comes after the last comma', async ({ page }) => {
    await page.locator('#bulkAddBtn').click();
    await page.locator('#bulkAddText').fill('English Language, Paper 1, 2h\nMaths - Paper 2 - 1h30m\nPhysics Paper 3');
    await page.locator('#bulkAddDefault').fill('45m');
    await page.locator('#bulkAddSave').click();
    await expect(page.locator('.timer-name')).toHaveText(['English Language, Paper 1', 'Maths - Paper 2', 'Physics Paper 3']);
    await expect(page.locator('.timer-display')).toHaveText(['2:00:00', '1:30:00', '45:00']);
  });

  test('reports the exact bad line and adds nothing', async ({ page }) => {
    await page.locator('#bulkAddBtn').click();
    await page.locator('#bulkAddText').fill('Biology, 1h\nChemistry, 2 houses');
    await page.locator('#bulkAddSave').click();
    await expect(page.locator('#bulkAddError')).toContainText('Line 2');
    await expect(page.locator('.timer-box')).toHaveCount(0);
  });
});

test.describe('Quick fill', () => {
  test('fills the duration and adds straight away when a name is typed', async ({ page }) => {
    await page.locator('#timerName').fill('History Paper 1');
    await page.locator('.quick-duration-btn', { hasText: '1h 30m' }).click();
    await expect(page.locator('.timer-box')).toHaveCount(1);
    await expect(page.locator('.timer-display')).toHaveText('1:30:00');
    await expect(page.locator('#promptModal')).not.toHaveClass(/active/);
  });

  test('without a name it fills the duration and focuses the name field', async ({ page }) => {
    await page.locator('.quick-duration-btn', { hasText: '2 hours' }).click();
    await expect(page.locator('#timerDuration')).toHaveValue('2h');
    await expect(page.locator('#timerName')).toBeFocused();
    await expect(page.locator('.timer-box')).toHaveCount(0);
  });
});

test.describe('Lock', () => {
  test('keyboard shortcuts cannot pause or change anything while locked', async ({ page }) => {
    await addTimer(page, 'Mathematics', '1h');
    await page.locator('#startAllBtn').click();
    await expect(page.locator('.timer-box.status-running')).toHaveCount(1);
    await page.locator('#controlLockToggle').click();
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('Space');
    await page.keyboard.press('p');
    await page.keyboard.press('r');
    await expect(page.locator('.timer-box.status-running')).toHaveCount(1);
    await expect(page.locator('body')).not.toHaveClass(/presentation-mode/);
    await expect(page.locator('#readingTimeContainer')).not.toHaveClass(/active/);
    await expect(page.locator('#toast')).toContainText('locked');
  });
});

test.describe('States students can read', () => {
  test('a paused exam says PAUSED; an untouched one says READY', async ({ page }) => {
    await addTimer(page, 'Started then paused', '1h');
    await addTimer(page, 'Not started', '1h');
    await page.locator('.timer-play').first().click();
    await page.waitForTimeout(1200);
    await page.locator('.timer-play').first().click();
    await expect(page.locator('.timer-status').nth(0)).toHaveText('Paused');
    await expect(page.locator('.timer-status').nth(1)).toHaveText('Ready');
  });

  test('exam type colour only matches the whole word IB', async ({ page }) => {
    const types = await page.evaluate(() => [getExamType('Bible Knowledge'), getExamType('IB Chemistry HL'), getExamType('Caribbean Studies'), getExamType('A-Level Physics')]);
    expect(types).toEqual(['standard', 'ib', 'standard', 'igcse-a-level']);
  });
});

test.describe('Hall view on a 720p projector', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const count of [1, 2, 3, 4, 5, 6, 7]) {
    test(`${count} exam(s) fit on one screen with large digits`, async ({ page }) => {
      for (let i = 0; i < count; i++) {
        await addTimer(page, 'International Examination Subject Number ' + (i + 1) + ' Paper 2', '1h30m');
      }
      await page.locator('#visibilityToggle').click();
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => {
        const container = document.querySelector('.container');
        const displays = Array.from(document.querySelectorAll('.timer-display'));
        return {
          overflowY: container.scrollHeight - container.clientHeight,
          clipped: displays.filter(el => el.scrollWidth > el.clientWidth + 2).length,
          minDigit: Math.min(...displays.map(el => parseFloat(getComputedStyle(el).fontSize))),
          brokenWords: Array.from(document.querySelectorAll('.timer-name')).some(el => getComputedStyle(el).wordBreak === 'break-all')
        };
      });
      expect(metrics.overflowY).toBeLessThanOrEqual(1);
      expect(metrics.clipped).toBe(0);
      expect(metrics.brokenWords).toBe(false);
      // The old layout rendered ~70px digits for 6 exams at this size.
      expect(metrics.minDigit).toBeGreaterThan(count <= 6 ? 100 : 80);
    });
  }
});

test.describe('Sessions', () => {
  test('deleting a session removes the one clicked even with duplicate names', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('naisula_exam_sessions', JSON.stringify([
        { name: 'Mock', timers: [{ name: 'A', duration: 60 }] },
        { name: 'Mock', timers: [{ name: 'B', duration: 60 }, { name: 'C', duration: 60 }] }
      ]));
      renderSessionList();
    });
    await page.locator('.session-chip-del').nth(1).click();
    await page.locator('#confirmModalOk').click();
    const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('naisula_exam_sessions')));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].timers[0].name).toBe('A');
  });
});

test.describe('Renaming', () => {
  test('Esc cancels a rename', async ({ page }) => {
    await addTimer(page, 'Original name', '1h');
    await page.locator('.timer-name').first().click();
    await page.locator('.timer-name-input').fill('Changed');
    await page.keyboard.press('Escape');
    await expect(page.locator('.timer-name').first()).toHaveText('Original name');
  });
});

test.describe('Exam names are never clipped', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Where the glyph ink ends (incl. g/y/p descenders) must stay inside the name box, unless the
  // name is deliberately clamped with an ellipsis.
  async function clippedNames(page) {
    return page.evaluate(() => Array.from(document.querySelectorAll('.timer-name')).filter(el => {
      if (el.style.getPropertyValue('-webkit-line-clamp')) return false; // clamped on purpose
      const range = document.createRange();
      range.selectNodeContents(el);
      const inkBottom = Math.max(...Array.from(range.getClientRects()).map(r => r.bottom));
      const size = parseFloat(getComputedStyle(el).fontSize);
      const box = el.getBoundingClientRect();
      const header = el.closest('.timer-header').getBoundingClientRect();
      return inkBottom + size * 0.06 > box.bottom + 1 || box.top < header.top - 1 || box.bottom > header.bottom + 1;
    }).map(el => el.textContent));
  }

  test('descenders and long names fit at every size, in setup and hall view', async ({ page }) => {
    for (const name of ['gigi', 'Geography Paper 1 (yearly)', 'Physics, Biology and Chemistry: Paper 2 Theory Questions']) {
      await addTimer(page, name);
    }
    for (const preset of ['compact', 'desk', 'classroom', 'hall']) {
      await page.locator('#timerSizePreset').selectOption(preset);
      expect(await clippedNames(page), 'setup ' + preset).toEqual([]);
    }
    await page.locator('#visibilityToggle').click();
    await page.waitForTimeout(200);
    for (let step = 0; step < 4; step++) {
      expect(await clippedNames(page), 'hall step ' + step).toEqual([]);
      await page.locator('#zoomInBtn').click({ force: true });
    }
    for (let step = 0; step < 6; step++) {
      await page.locator('#zoomOutBtn').click({ force: true });
      expect(await clippedNames(page), 'hall out ' + step).toEqual([]);
    }
  });
});
