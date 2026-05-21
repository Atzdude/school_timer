# Reliability Fixes — Exam Timer
**Date:** 2026-05-01  
**Scope:** Issues 1–5 from the pre-finals edge-case audit. Issues 6–7 handled in a separate pass after regression testing.

---

## Context

This app will be used live during final exams in front of students. Five confirmed bugs could cause visible, embarrassing failures. The fixes below make the timer correct under every realistic classroom condition: minimized window, laptop sleep, accidental double-open, power loss, and reading-time drift.

---

## Fix 1 — RAF stops when window is minimized (silent timer completion)

**Problem:** `requestAnimationFrame` pauses in Electron when the window is minimized or hidden. A timer that expires while the window is down never calls `completeTimer`, never blinks, never moves to the done shelf — until the teacher brings the window back up.

**Fix:**
- Add a `document.addEventListener('visibilitychange', onVisibilityChange)` handler.
- On `hidden`: record `_hiddenAt = Date.now()`.
- On `visible`:
  1. Call `ensureDisplayLoop()` to restart the RAF.
  2. Immediately sync all running timers: any timer whose `endTime < Date.now()` gets `completeTimer()` called right now, not on the next RAF frame.
  3. Show an informational banner (reuse `showClockStatus`) if hidden > 10 seconds: *"Screen was hidden for X seconds — timers have been updated."*

**Files:** `timer_fixed_v2.html` — add handler after the `ensureDisplayLoop` definition.

---

## Fix 2 — No save-on-close (up to 60s state loss on power cut / force-quit)

**Problem:** The only save is a 60-second heartbeat. If the app is force-closed or power dies, up to 60 seconds of added timers, name changes, etc. are lost.

**Two-part fix:**

**Part A — `beforeunload` in renderer:**  
Add `window.addEventListener('beforeunload', saveTimers)` in the HTML. This fires whenever the Electron window closes normally (teacher quits, window X button). Covers the vast majority of real cases.

**Part B — reduce heartbeat 60s → 10s:**  
Change `const TIMER_HEARTBEAT_MS = 60000` to `10000`. Power cuts are unpreventable in software, but a 10-second worst-case loss is acceptable. 60 seconds is not.

**Files:** `timer_fixed_v2.html` — two-line change (`TIMER_HEARTBEAT_MS` constant + `beforeunload` listener).

---

## Fix 3 — Sleep/wake gives no warning (lap timer resumes silently)

**Problem:** The existing drift guard (`TIMER_CLOCK_MAX_ELAPSED_MS = 24h`) never fires for a realistic laptop sleep (20 min). When the teacher opens the laptop mid-exam, the timers silently resume from the correct deadline — which is right — but the teacher has no idea the screen was dark. A 20-minute unnoticed sleep could mean a student's exam ended while nobody was watching.

**Fix:**
- This shares the `visibilitychange` handler from Fix 1.
- The banner threshold is 10 seconds of hidden time. Any sleep longer than that triggers: *"Screen was hidden for [X min Y sec] — timers resumed from saved deadline."*
- The timers themselves are NOT paused (the deadline is still valid). This is purely informational.
- `TIMER_CLOCK_MAX_ELAPSED_MS` stays at 24h — it is a last-resort backstop for pathological clock jumps, not a sleep detector. The `visibilitychange` approach is the correct mechanism for this use case.

**Files:** `timer_fixed_v2.html` — handled by Fix 1's handler, no separate change needed.

---

## Fix 4 — Reading time uses counter-decrement, not a deadline (drifts on sleep)

**Problem:** `readingTimeRemaining--` runs inside `setInterval(..., 1000)`. Unlike exam timers, it has no `endTime`. Any laptop sleep during reading time loses those seconds forever. A 2-minute sleep = reading time shows 2 extra minutes remaining that don't exist.

**Fix:**
- Add `let readingTimeEndMs = null` state variable.
- In `startReadingTime()`: set `readingTimeEndMs = Date.now() + 300_000`.
- Change the interval to compute `remaining = Math.max(0, Math.ceil((readingTimeEndMs - Date.now()) / 1000))` instead of decrementing.
- In `toggleReadingTimePause()`:
  - When **pausing**: set `readingTimeEndMs = null` (stop the clock), keep `readingTimeRemaining` as the last computed value.
  - When **unpausing**: set `readingTimeEndMs = Date.now() + readingTimeRemaining * 1000` (restart clock from current remaining).
- The `visibilitychange` handler from Fix 1 also covers reading time: on `visible`, if reading time is active and not paused, recalculate from `readingTimeEndMs` correctly.

**Files:** `timer_fixed_v2.html` — `startReadingTime`, `toggleReadingTimePause`, interval callback (~10 lines).

---

## Fix 5 — Two Electron windows open simultaneously (localStorage clobber)

**Problem:** Electron does not prevent a second window from opening. Both share `localStorage`. Both run the 10-second heartbeat. Whichever saves last wins, silently overwriting the other. Teacher accidentally double-clicks the app icon → second window opens → both corrupt each other.

**Fix:**
- Use `app.requestSingleInstanceLock()` in `main.js`.
- If the lock is not obtained (second instance), call `app.quit()` immediately.
- In the first instance, handle `app.on('second-instance', ...)` to restore and focus the existing window (so the dock-click / taskbar-click behavior still feels natural).

**Files:** `main.js` — ~10 lines wrapping the existing `app.whenReady()` block.

---

## Regression Tests

After implementation, verify each fix manually:

| Fix | Test |
|-----|------|
| 1 | Start a 10-second timer → minimize window → wait 15s → restore → confirm timer completed and chip appears |
| 1 | Start a 30-second timer → minimize for 5s → restore → confirm banner appears and timer shows correct remaining time |
| 2 | Add a timer → wait 5s (not 10s) → force-quit via Activity Monitor → reopen → timer should still be there |
| 2 | Add a timer → immediately close window (X button) → reopen → timer should still be there |
| 3 | Start a timer → sleep laptop 30s → wake → confirm informational banner appears, timer time is correct |
| 4 | Start reading time → sleep laptop 30s → wake → confirm reading time did NOT gain extra seconds |
| 4 | Start reading time → pause → sleep 30s → wake → resume → confirm time resumes from where paused |
| 5 | Double-click app icon → confirm second window does not open; first window is focused instead |

---

## Out of Scope (Next Pass)

- Fix 6: Space key in modal breaks Save/Cancel (MEDIUM)
- Fix 7: Ghost done-chip after rapid delete of running timer (MEDIUM)
