# PROJECT: Exam Timer - Windows App Packaging

## Goal

Package `timer_fixed_v2.html` as a standalone Windows desktop app for offline school use.

## Current Project State

- This folder is now an Electron app.
- `main.js` is the Electron main process and loads `timer_fixed_v2.html`.
- `electron-builder` is configured in `package.json`.
- Windows targets are configured as `x64` NSIS installer and `x64` portable EXE.
- `npm install` has been run locally and produced `package-lock.json`.

## Key Files

- `timer_fixed_v2.html` - the full timer app.
- `main.js` - Electron wrapper.
- `build/icon.ico` - Windows app icon generated from the supplied clock image.
- `package.json` - scripts, Electron dependencies, and build settings.
- `tests/timer_deadline.test.js` - dependency-free Node test suite for timer parsing, IDs, presentation-mode done shelf visibility, long-title header layout, icon-only presentation controls, Keep Done timing, keyboard shortcuts, persistence, and clock recovery.
- `README.md` - local run/test/build instructions.

## Commands

Run the desktop app locally:

```bash
npm start
```

Run validation tests:

```bash
npm test
```

Build Windows x64 installer plus portable EXE:

```bash
npm run dist:win
```

Build only the portable Windows x64 EXE:

```bash
npm run dist:win:portable
```

Output goes to:

```text
dist/
```

## Packaging Configuration

The project uses Electron plus electron-builder.

Important `package.json` settings:

- `main`: `main.js`
- `productName`: `timer`
- `appId`: `com.naisula.examtimer`
- `asar`: `true`
- bundled files: `main.js`, `timer_fixed_v2.html`, `build/icon.ico`, `package.json`
- Windows icon: `build/icon.ico`
- Packaged app name intentionally uses `timer` to avoid conflicting with existing school desktop items.
- Windows targets: `nsis` and `portable`
- Architecture: `x64`
- NSIS settings: assisted install, install directory selectable, desktop shortcut enabled, Start Menu shortcut enabled

## Implemented Timer Resilience

The timer does not rely on decrementing a countdown counter. Running timers persist a wall-clock deadline and derive the display from that deadline.

Saved timer fields include:

```json
{
  "id": 123,
  "name": "Math Paper 1",
  "duration": 7200,
  "remainingTime": 6900,
  "endTime": 1770000000000,
  "savedAt": 1769999700000,
  "isRunning": true,
  "completed": false,
  "color": "navy"
}
```

Behavior:

- On start, `endTime = Date.now() + remainingTime * 1000`.
- Each tick recalculates `remainingTime = Math.ceil((endTime - Date.now()) / 1000)`.
- Pause snapshots the derived remaining time, clears `endTime`, and saves.
- Reset clears completion/deadline state and restores the original duration.
- Startup resumes running timers if the saved clock looks sane.
- Startup marks expired sane deadlines as completed and shows `00:00:00`.
- If the system clock moved backwards or more than 24 hours elapsed since `savedAt`, the app falls back to saved `remainingTime`, pauses the timer, and shows a warning banner.
- A 60-second heartbeat save persists a fresh `remainingTime` snapshot as a backup.

## Validation Coverage

Current expected result:

```text
npm test
tests 17
pass 17
fail 0
```

The tests execute the actual inline script from `timer_fixed_v2.html` in a fake DOM with a fake clock. They verify duration parsing, unique timer IDs, presentation-mode done shelf visibility, long-title header layout, icon-only presentation controls, seven-second Keep Done flashing, the `R` reading-time shortcut, deadline saving, wall-clock tick recalculation, pause snapshots, startup resume, expired-deadline completion, suspicious-clock fallback, and reset behavior.

## Manual Power-Cut Test

Use this after launching the app with `npm start` or after packaging:

1. Create a `5m` timer.
2. Start it.
3. Wait until it shows roughly `04:30`.
4. Close the app completely.
5. Wait 60-90 seconds.
6. Reopen the app.
7. Expected: the timer resumes running and shows roughly `03:00-03:30`, not `05:00` and not the old frozen `04:30`.

## Offline Notes

- Google Fonts are still loaded from the CDN, but CSS includes local/system fallbacks.
- For fully identical offline typography, bundle local font files and update CSS `@font-face` rules before final shipment.
