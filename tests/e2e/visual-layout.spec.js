const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appUrl = pathToFileURL(path.join(__dirname, '..', '..', 'app', 'index.html')).toString();

test.use({ viewport: { width: 1440, height: 900 } });

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

// Returns { top, bottom, left, right } for an element
async function bounds(locator) {
  const box = await locator.boundingBox();
  return {
    top: box.y,
    bottom: box.y + box.height,
    left: box.x,
    right: box.x + box.width,
    width: box.width,
    height: box.height,
  };
}

// Check that no two timer cards have overlapping bounding boxes
async function assertNoOverlap(page) {
  const boxes = await page.locator('.timer-box').evaluateAll(els =>
    els.map(el => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    })
  );
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlapX = a.left < b.right && a.right > b.left;
      const overlapY = a.top < b.bottom && a.bottom > b.top;
      if (overlapX && overlapY) {
        throw new Error(`Timer cards ${i} and ${j} overlap. Card ${i}: ${JSON.stringify(a)}, Card ${j}: ${JSON.stringify(b)}`);
      }
    }
  }
}

// Check that timer display is fully within the card bounds (no overflow)
async function assertDisplayInsideCard(page) {
  const results = await page.locator('.timer-box').evaluateAll(els =>
    els.map((el, i) => {
      const card = el.getBoundingClientRect();
      const display = el.querySelector('.timer-display');
      if (!display) return null;
      const d = display.getBoundingClientRect();
      return {
        index: i,
        cardBottom: card.bottom,
        displayBottom: d.bottom,
        cardRight: card.right,
        displayRight: d.right,
        overflow: d.bottom > card.bottom + 2 || d.right > card.right + 2,
      };
    }).filter(Boolean)
  );
  const overflowing = results.filter(r => r.overflow);
  if (overflowing.length > 0) {
    throw new Error(`Timer display overflows card on ${overflowing.length} card(s): ${JSON.stringify(overflowing)}`);
  }
}

async function assertMinimumDisplaySize(page, minWidth, minHeight) {
  const displays = await page.locator('.timer-display').evaluateAll(els =>
    els.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { index: i, width: Math.round(r.width), height: Math.round(r.height) };
    })
  );
  const undersized = displays.filter(d => d.width < minWidth || d.height < minHeight);
  if (undersized.length > 0) {
    throw new Error(`Timer display is too small: ${JSON.stringify(undersized)}`);
  }
}

async function assertGridStartsInView(page) {
  const metrics = await page.evaluate(() => {
    const container = document.querySelector('.container').getBoundingClientRect();
    const grid = document.querySelector('.timers-grid').getBoundingClientRect();
    return {
      containerTop: Math.round(container.top),
      gridTop: Math.round(grid.top),
      scrollTop: Math.round(document.querySelector('.container').scrollTop)
    };
  });
  expect(metrics.scrollTop).toBe(0);
  expect(metrics.gridTop).toBeGreaterThanOrEqual(metrics.containerTop);
}

test.describe('Normal mode — layout', () => {
  test('single timer: display fills card, no clipping', async ({ page }) => {
    await addTimer(page, 'Mathematics Paper 1', '2h');
    await page.screenshot({ path: 'tests/screenshots/normal-1timer.png', fullPage: false });

    const card = await bounds(page.locator('.timer-box').first());
    const display = await bounds(page.locator('.timer-display').first());

    expect(display.height).toBeGreaterThan(80);
    expect(display.bottom).toBeLessThanOrEqual(card.bottom + 2);
    expect(display.right).toBeLessThanOrEqual(card.right + 2);
  });

  test('two timers: no overlap', async ({ page }) => {
    await addTimer(page, 'Mathematics Paper 1', '2h');
    await addTimer(page, 'Biology Paper 2', '1h30m');
    await page.screenshot({ path: 'tests/screenshots/normal-2timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('four timers: no overlap', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await addTimer(page, 'Physics Paper 3 Advanced', '1h');
    await addTimer(page, 'Chemistry', '45m');
    await page.screenshot({ path: 'tests/screenshots/normal-4timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('six timers: no overlap', async ({ page }) => {
    const subjects = ['Mathematics', 'Biology', 'Physics', 'Chemistry', 'English Literature', 'History'];
    for (const s of subjects) await addTimer(page, s, '1h');
    await page.screenshot({ path: 'tests/screenshots/normal-6timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('long title: wraps or truncates, display still visible', async ({ page }) => {
    await addTimer(page, 'International Advanced Level Mathematics Paper 1: Pure Mathematics Unit Test', '3h');
    await page.screenshot({ path: 'tests/screenshots/normal-long-title.png', fullPage: false });
    const display = await bounds(page.locator('.timer-display').first());
    expect(display.height).toBeGreaterThan(60);
    await assertDisplayInsideCard(page);
  });
});

test.describe('Presentation mode — layout at different zoom levels', () => {
  async function enterPresentation(page) {
    await page.locator('#visibilityToggle').click();
    await expect(page.locator('body')).toHaveClass(/presentation-mode/);
    await page.waitForTimeout(300);
  }

  test('1 timer in presentation: display large, no overflow', async ({ page }) => {
    await addTimer(page, 'Mathematics Paper 1', '2h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-1timer-default.png', fullPage: false });

    const card = await bounds(page.locator('.timer-box').first());
    const display = await bounds(page.locator('.timer-display').first());

    expect(display.height).toBeGreaterThan(150);
    expect(display.bottom).toBeLessThanOrEqual(card.bottom + 4);
    expect(display.right).toBeLessThanOrEqual(card.right + 4);
  });

  test('2 timers in presentation: no overlap, display inside card', async ({ page }) => {
    await addTimer(page, 'Mathematics Paper 1', '2h');
    await addTimer(page, 'Biology Paper 2', '1h30m');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-2timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('3 timers in presentation: reflows into larger readable cards', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await addTimer(page, 'Physics', '1h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-3timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 640, 240);
  });

  test('4 timers in presentation: no overlap, display inside card', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await addTimer(page, 'Physics', '1h');
    await addTimer(page, 'Chemistry Paper 3', '45m');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-4timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('5 timers in presentation: keeps display readable without overlap', async ({ page }) => {
    const subjects = ['Mathematics', 'Biology', 'Physics', 'Chemistry', 'English Literature'];
    for (const s of subjects) await addTimer(page, s, '1h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-5timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 440, 210);
  });

  test('6 timers in presentation: no overlap, display inside card', async ({ page }) => {
    const subjects = ['Mathematics', 'Biology', 'Physics', 'Chemistry', 'English Literature', 'History'];
    for (const s of subjects) await addTimer(page, s, '1h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-6timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 440, 210);
  });

  test('7 timers in presentation: reflows instead of shrinking into tiny columns', async ({ page }) => {
    const subjects = ['Mathematics', 'Biology', 'Physics', 'Chemistry', 'English Literature', 'History', 'Geography'];
    for (const s of subjects) await addTimer(page, s, '1h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-7timers.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 440, 210);
  });

  test('7 timers in presentation at 125 percent: long titles do not crowd rows', async ({ page }) => {
    const subjects = [
      'OUT HUOSTH UOST HUOSTH O',
      'T SJOTSO',
      'U STP TOPSU TOP',
      'PGSNJG NSJIG NSJOG NSO N SPOGS',
      'PTW',
      'PTNS',
      'F'
    ];
    for (const s of subjects) await addTimer(page, s, '1h');
    await enterPresentation(page);
    for (let i = 0; i < 3; i++) await page.locator('#zoomInBtn').click();
    await page.screenshot({ path: 'tests/screenshots/pres-7timers-125.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 680, 260);
    await assertGridStartsInView(page);
  });

  test('long title in presentation: no overflow', async ({ page }) => {
    await addTimer(page, 'International Advanced Level Mathematics Paper 1: Pure Mathematics Unit Test', '3h');
    await addTimer(page, 'Biology Advanced Subsidiary Unit 2: Development and Biodiversity', '2h');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-long-titles.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('4 timers at large zoom: long names cannot swallow the timer display', async ({ page }) => {
    await addTimer(page, 'NBFJIFNISH OUSHTU OSHTUHSTUO HUTO SHO TUHSUOT HOSU TH UOSTHOUST', '1h30m');
    await addTimer(page, 'English P2 0500 IGCSE BFISO SHTOS THO STH OS HTOUHTUOS HTUOS HOTTSO', '1h');
    await addTimer(page, 'Math', '1h30m');
    await addTimer(page, 'Chemistry', '1h45m');
    await enterPresentation(page);
    await page.locator('#zoomInBtn').click();
    await page.screenshot({ path: 'tests/screenshots/pres-4timers-long-names-large.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
    await assertMinimumDisplaySize(page, 680, 230);
  });

  test('zoom out (compact preset) in presentation: no overlap', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await addTimer(page, 'Physics', '1h');
    await page.locator('#timerSizePreset').selectOption('compact');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-compact-zoom.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);
  });

  test('zoom in (hall preset) in presentation: display very large, no overflow', async ({ page }) => {
    await addTimer(page, 'Mathematics Paper 1', '2h');
    await page.locator('#timerSizePreset').selectOption('hall');
    await enterPresentation(page);
    await page.screenshot({ path: 'tests/screenshots/pres-hall-zoom.png', fullPage: false });

    const card = await bounds(page.locator('.timer-box').first());
    const display = await bounds(page.locator('.timer-display').first());
    expect(display.height).toBeGreaterThan(200);
    expect(display.bottom).toBeLessThanOrEqual(card.bottom + 4);
  });

  test('zoom buttons step correctly and stay in bounds', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await enterPresentation(page);

    const initial = await page.locator('#zoomResetBtn').textContent();

    // step in 3 times
    for (let i = 0; i < 3; i++) await page.locator('#zoomInBtn').click();
    await page.screenshot({ path: 'tests/screenshots/pres-zoomed-in.png', fullPage: false });
    await assertDisplayInsideCard(page);

    // step out 6 times
    for (let i = 0; i < 6; i++) await page.locator('#zoomOutBtn').click();
    await page.screenshot({ path: 'tests/screenshots/pres-zoomed-out.png', fullPage: false });
    await assertNoOverlap(page);
    await assertDisplayInsideCard(page);

    // reset
    await page.locator('#zoomResetBtn').click();
    const after = await page.locator('#zoomResetBtn').textContent();
    expect(after).toBe(initial);
  });

  test('4 timers: display time text is not clipped horizontally', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await addTimer(page, 'Physics', '1h');
    await addTimer(page, 'Chemistry', '45m');
    await enterPresentation(page);

    // scrollWidth > clientWidth means text is clipped
    const clipped = await page.locator('.timer-display').evaluateAll(els =>
      els.map((el, i) => ({ index: i, clipped: el.scrollWidth > el.clientWidth + 4 }))
    );
    const clippedItems = clipped.filter(c => c.clipped);
    expect(clippedItems).toHaveLength(0);
  });
});

test.describe('No blue strip (no navy background visible below display)', () => {
  test('normal mode: timer-display fills card body vertically', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    // The display should fill the body of the card — no gap at bottom showing navy gradient
    const bodyBox = await page.locator('.timer-body').first().boundingBox();
    const displayBox = await page.locator('.timer-display').first().boundingBox();
    // display bottom should be within a few px of timer-body bottom
    const gap = bodyBox.y + bodyBox.height - (displayBox.y + displayBox.height);
    expect(Math.abs(gap)).toBeLessThan(10);
  });

  test('presentation mode: no gap between display and card body bottom', async ({ page }) => {
    await addTimer(page, 'Mathematics', '2h');
    await addTimer(page, 'Biology', '1h30m');
    await page.locator('#visibilityToggle').click();
    await expect(page.locator('body')).toHaveClass(/presentation-mode/);
    await page.waitForTimeout(300);

    const bodyBoxes = await page.locator('.timer-body').evaluateAll(els =>
      els.map(el => { const r = el.getBoundingClientRect(); return { bottom: r.bottom }; })
    );
    const displayBoxes = await page.locator('.timer-display').evaluateAll(els =>
      els.map(el => { const r = el.getBoundingClientRect(); return { bottom: r.bottom }; })
    );
    for (let i = 0; i < bodyBoxes.length; i++) {
      const gap = bodyBoxes[i].bottom - displayBoxes[i].bottom;
      expect(Math.abs(gap)).toBeLessThan(10);
    }
  });
});
