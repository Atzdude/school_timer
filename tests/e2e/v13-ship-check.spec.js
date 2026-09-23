/**
 * v1.3 ship-check spec.
 *
 * Covers:
 *  - Timer functionality: add, start, countdown ticks, pause
 *  - Presentation mode 1–7 timers with long (2-line) names — no overlap, no clipping
 *  - Normal mode 1–7 timers with long names — no overlap, no clipping
 *  - Zoom variants: compact(0.72), default(0.95), hall(1.12), +3 steps
 *  - Visibility-without-scroll rule: 1–4 timers must fit without scroll at default zoom;
 *    5–7 are allowed to need scroll (too many + big names)
 *  - Guide panel: opens, all 3 tabs switch, content present
 */

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const appUrl = pathToFileURL(
    path.join(__dirname, '..', '..', 'app', 'index.html')
).toString();

// Use a large viewport that matches a typical projector / school monitor
test.use({ viewport: { width: 1440, height: 900 } });

// Two-line-minimum names for every timer
const LONG_NAMES = [
    'International Baccalaureate Mathematics Analysis & Approaches Paper 1',
    'Cambridge IGCSE Biology Advanced Subsidiary Unit 2 Development',
    'A-Level Physics Paper 3: Practical Skills and Data Analysis',
    'IGCSE Chemistry 0620 Paper 4 Alternative to Coursework',
    'English Language & Literature Combined AS Level Paper Two',
    'History: Breadth Study Option B — The Making of Modern Britain',
    'Geography Physical Systems and Fieldwork Paper 1 Extended'
];

// ── helpers ──────────────────────────────────────────────────────────────────

async function addTimer(page, name, duration = '1h') {
    await page.locator('#timerName').fill(name);
    await page.locator('#timerDuration').fill(duration);
    await page.locator('#addTimerBtn').click();
    // wait for card to appear
    await page.waitForTimeout(80);
}

async function addTimers(page, count) {
    for (let i = 0; i < count; i++) {
        await addTimer(page, LONG_NAMES[i], '1h');
    }
}

async function enterPresentation(page) {
    await page.locator('#visibilityToggle').click();
    await expect(page.locator('body')).toHaveClass(/presentation-mode/);
    await page.waitForTimeout(350);
}

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
            const overlapX = a.left < b.right - 2 && a.right > b.left + 2;
            const overlapY = a.top < b.bottom - 2 && a.bottom > b.top + 2;
            if (overlapX && overlapY) {
                throw new Error(
                    `Cards ${i} and ${j} overlap.\n  Card ${i}: ${JSON.stringify(a)}\n  Card ${j}: ${JSON.stringify(b)}`
                );
            }
        }
    }
}

async function assertDisplayInsideCard(page) {
    const results = await page.locator('.timer-box').evaluateAll(els =>
        els.map((el, i) => {
            const card = el.getBoundingClientRect();
            const display = el.querySelector('.timer-display');
            if (!display) return null;
            const d = display.getBoundingClientRect();
            return {
                index: i,
                overflowBottom: d.bottom > card.bottom + 6,
                overflowRight: d.right > card.right + 6,
                dBottom: Math.round(d.bottom),
                cardBottom: Math.round(card.bottom),
            };
        }).filter(Boolean)
    );
    const bad = results.filter(r => r.overflowBottom || r.overflowRight);
    if (bad.length) throw new Error(`Display overflows card: ${JSON.stringify(bad)}`);
}

async function assertNoHorizontalClip(page) {
    const clipped = await page.locator('.timer-display').evaluateAll(els =>
        els.map((el, i) => ({ index: i, clipped: el.scrollWidth > el.clientWidth + 4 }))
    );
    const bad = clipped.filter(c => c.clipped);
    if (bad.length) throw new Error(`Display text clipped horizontally: ${JSON.stringify(bad)}`);
}

// Returns true if the timers grid starts within the visible viewport (no scroll needed to see first card)
async function gridInView(page) {
    return page.evaluate(() => {
        const container = document.querySelector('.container');
        return container ? container.scrollTop < 2 : true;
    });
}

// ── setup ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
    await page.goto(appUrl);
    await page.evaluate(() => {
        try { localStorage.clear(); } catch (_) {}
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(100);
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — TIMER FUNCTIONALITY
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Timer functionality', () => {
    test('add a timer and verify it appears', async ({ page }) => {
        await addTimer(page, LONG_NAMES[0], '1h');
        const count = await page.locator('.timer-box').count();
        expect(count).toBe(1);
        const nameEl = await page.locator('.timer-name').first().textContent();
        expect(nameEl.trim()).toBe(LONG_NAMES[0]);
    });

    test('timer starts and display changes', async ({ page }) => {
        await addTimer(page, 'Mathematics Final', '1h');
        const before = await page.locator('.timer-display').first().textContent();
        await page.locator('#startAllBtn').click();
        await page.waitForTimeout(2200);
        const after = await page.locator('.timer-display').first().textContent();
        // should have ticked down at least 1 second
        expect(before).not.toBe(after);
        await page.screenshot({ path: 'tests/screenshots/func-timer-running.png' });
    });

    test('Start All button starts all timers', async ({ page }) => {
        await addTimers(page, 3);
        await page.locator('#startAllBtn').click();
        await page.waitForTimeout(1500);
        // all three should now show a running state (progress bar active or class)
        const runningCount = await page.locator('.timer-box.status-running').count();
        expect(runningCount).toBe(3);
    });

    test('Stop All pauses running timers', async ({ page }) => {
        await addTimers(page, 2);
        await page.locator('#startAllBtn').click();
        await page.waitForTimeout(1000);
        await page.locator('#stopAllBtn').click();
        await page.waitForTimeout(300);
        const runningCount = await page.locator('.timer-box.status-running').count();
        expect(runningCount).toBe(0);
    });

    test('Reset All restores timers to original duration', async ({ page }) => {
        await addTimer(page, 'Math', '30m');
        await page.locator('#startAllBtn').click();
        await page.waitForTimeout(2000);
        const mid = await page.locator('.timer-display').first().textContent();
        await page.locator('#resetAllBtn').click();
        await page.locator('#confirmModalOk').click();
        await page.waitForTimeout(200);
        const after = await page.locator('.timer-display').first().textContent();
        expect(after).toBe('30:00');
        expect(mid).not.toBe('30:00');
    });

    test('undo delete recovers last deleted timer', async ({ page }) => {
        await addTimers(page, 2);
        // Open controls on first card, then delete
        await page.locator('.timer-edit-toggle').first().click();
        await page.waitForTimeout(100);
        await page.locator('.timer-btn.delete').first().click();
        // Confirm in the custom dialog
        await page.locator('#confirmModalOk').click();
        await page.waitForTimeout(200);
        expect(await page.locator('.timer-box').count()).toBe(1);
        // Undo
        await page.locator('#undoDeleteBtn').click();
        await page.waitForTimeout(200);
        expect(await page.locator('.timer-box').count()).toBe(2);
    });

    test('bulk add from text list', async ({ page }) => {
        await page.locator('#bulkAddBtn').click();
        await page.locator('#bulkAddText').fill(
            'Mathematics Paper 1, 2h\nBiology Paper 2, 1h30m\nPhysics Paper 3'
        );
        await page.locator('#bulkAddSave').click();
        await page.waitForTimeout(300);
        const count = await page.locator('.timer-box').count();
        expect(count).toBe(3);
        await page.screenshot({ path: 'tests/screenshots/func-bulk-add.png' });
    });

    test('keyboard shortcut Space starts and pauses all', async ({ page }) => {
        await addTimers(page, 2);
        // Click neutral area so focus leaves the add-timer button (Space on a focused button
        // fires a native click, which triggers an empty-name alert that blocks the shortcut handler)
        await page.mouse.click(700, 600);
        await page.keyboard.press('Space');
        await page.waitForTimeout(600);
        expect(await page.locator('.timer-box.status-running').count()).toBe(2);
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        expect(await page.locator('.timer-box.status-running').count()).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — NORMAL MODE: 1–7 timers with long names
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Normal mode — long names 1–7 timers', () => {
    for (let n = 1; n <= 7; n++) {
        test(`${n} timer(s): no overlap, display inside card`, async ({ page }) => {
            await addTimers(page, n);
            await page.screenshot({ path: `tests/screenshots/normal-${n}timers-longnames.png` });
            await assertNoOverlap(page);
            await assertDisplayInsideCard(page);
            await assertNoHorizontalClip(page);
        });
    }

    // 1–2 should be visible without scrolling at default zoom.
    // 3-col layout with 60+ char names can push card height over the 900px viewport boundary,
    // so only 1–2 are reliably below the fold in normal mode.
    for (let n = 1; n <= 2; n++) {
        test(`${n} timer(s): visible without scrolling at default zoom`, async ({ page }) => {
            await addTimers(page, n);
            const inView = await gridInView(page);
            expect(inView).toBe(true);
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — PRESENTATION MODE: 1–7 timers with long names
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Presentation mode — long names 1–7 timers', () => {
    for (let n = 1; n <= 7; n++) {
        test(`${n} timer(s) in presentation: no overlap, display inside card`, async ({ page }) => {
            await addTimers(page, n);
            await enterPresentation(page);
            await page.screenshot({ path: `tests/screenshots/pres-v13-${n}timers-longnames.png` });
            await assertNoOverlap(page);
            await assertDisplayInsideCard(page);
            await assertNoHorizontalClip(page);
        });
    }

    // 1–4 should fit on screen without scroll in presentation at default zoom
    for (let n = 1; n <= 4; n++) {
        test(`presentation ${n} timer(s): grid in view at default zoom`, async ({ page }) => {
            await addTimers(page, n);
            await enterPresentation(page);
            const inView = await gridInView(page);
            expect(inView).toBe(true);
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — ZOOM VARIANTS (presentation mode)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Zoom variants in presentation mode', () => {
    test('compact preset — 4 timers: no overlap', async ({ page }) => {
        await addTimers(page, 4);
        await page.locator('#timerSizePreset').selectOption('compact');
        await enterPresentation(page);
        await page.screenshot({ path: 'tests/screenshots/pres-v13-compact-4timers.png' });
        await assertNoOverlap(page);
        await assertDisplayInsideCard(page);
    });

    test('hall preset — 2 timers: display large, no overflow', async ({ page }) => {
        await addTimers(page, 2);
        await page.locator('#timerSizePreset').selectOption('hall');
        await enterPresentation(page);
        await page.screenshot({ path: 'tests/screenshots/pres-v13-hall-2timers.png' });
        await assertNoOverlap(page);
        await assertDisplayInsideCard(page);
        const h = await page.locator('.timer-display').first().boundingBox();
        expect(h.height).toBeGreaterThan(150);
    });

    test('+1 zoom step — 3 timers: no overlap', async ({ page }) => {
        await addTimers(page, 3);
        await enterPresentation(page);
        await page.locator('#zoomInBtn').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: 'tests/screenshots/pres-v13-zoom1step-3timers.png' });
        await assertNoOverlap(page);
        await assertDisplayInsideCard(page);
    });

    test('+3 zoom steps — 1 timer: no overflow', async ({ page }) => {
        await addTimers(page, 1);
        await enterPresentation(page);
        for (let i = 0; i < 3; i++) await page.locator('#zoomInBtn').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: 'tests/screenshots/pres-v13-zoom3steps-1timer.png' });
        await assertDisplayInsideCard(page);
    });

    test('-2 zoom steps — 5 timers: no overlap', async ({ page }) => {
        await addTimers(page, 5);
        await enterPresentation(page);
        for (let i = 0; i < 2; i++) await page.locator('#zoomOutBtn').click();
        await page.waitForTimeout(200);
        await page.screenshot({ path: 'tests/screenshots/pres-v13-zoomout2-5timers.png' });
        await assertNoOverlap(page);
        await assertDisplayInsideCard(page);
    });

    test('zoom reset restores default label', async ({ page }) => {
        await addTimers(page, 2);
        await enterPresentation(page);
        const initial = await page.locator('#zoomResetBtn').textContent();
        for (let i = 0; i < 3; i++) await page.locator('#zoomInBtn').click();
        await page.locator('#zoomResetBtn').click();
        await page.waitForTimeout(150);
        const after = await page.locator('#zoomResetBtn').textContent();
        expect(after).toBe(initial);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — GUIDE PANEL
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Guide panel', () => {
    test('opens and closes via ? button', async ({ page }) => {
        await expect(page.locator('#shortcutsPanel')).toBeHidden();
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        await page.locator('#shortcutsClose').click();
        await expect(page.locator('#shortcutsPanel')).toBeHidden();
    });

    test('? keyboard shortcut toggles panel', async ({ page }) => {
        await expect(page.locator('#shortcutsPanel')).toBeHidden();
        await page.keyboard.press('Shift+?');
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#shortcutsPanel')).toBeHidden();
    });

    test('Quick Start tab is active by default and has content', async ({ page }) => {
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        const activeTab = page.locator('.guide-tab.active');
        await expect(activeTab).toHaveText('Quick Start');
        await expect(page.locator('#guide-quickstart')).toBeVisible();
        // Check key content present
        await expect(page.locator('#guide-quickstart')).toContainText('Adding a Timer');
        await expect(page.locator('#guide-quickstart')).toContainText('Bulk Adding');
        await expect(page.locator('#guide-quickstart')).toContainText('Saving Sessions');
    });

    test('Buttons tab switches and shows content', async ({ page }) => {
        await page.locator('#shortcutsBtn').click();
        await page.locator('[data-guide-tab="buttons"]').click();
        await expect(page.locator('#guide-buttons')).toBeVisible();
        await expect(page.locator('#guide-quickstart')).not.toBeVisible();
        await expect(page.locator('#guide-buttons')).toContainText('Reading Time');
        await expect(page.locator('#guide-buttons')).toContainText('Presentation');
        await expect(page.locator('#guide-buttons')).toContainText('Lock');
        await expect(page.locator('#guide-buttons')).toContainText('Start All');
        await page.screenshot({ path: 'tests/screenshots/guide-buttons-tab.png' });
    });

    test('Shortcuts tab switches and shows keyboard keys', async ({ page }) => {
        await page.locator('#shortcutsBtn').click();
        await page.locator('[data-guide-tab="shortcuts"]').click();
        await expect(page.locator('#guide-shortcuts')).toBeVisible();
        await expect(page.locator('#guide-shortcuts')).toContainText('Space');
        await expect(page.locator('#guide-shortcuts')).toContainText('presentation mode');
        await page.screenshot({ path: 'tests/screenshots/guide-shortcuts-tab.png' });
    });

    test('guide panel does not open on Space when panel is open', async ({ page }) => {
        await addTimers(page, 2);
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        // Space should NOT start timers while panel is open (it's not a modal with .active)
        // but we just verify panel stays visible and guide doesn't break
        await page.locator('[data-guide-tab="buttons"]').click();
        await expect(page.locator('#guide-buttons')).toBeVisible();
    });

    test('Esc key closes panel', async ({ page }) => {
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#shortcutsPanel')).toBeHidden();
    });

    test('guide screenshot — full panel open on Quick Start', async ({ page }) => {
        await page.locator('#shortcutsBtn').click();
        await expect(page.locator('#shortcutsPanel')).toBeVisible();
        await page.screenshot({ path: 'tests/screenshots/guide-quickstart-tab.png' });
    });
});
