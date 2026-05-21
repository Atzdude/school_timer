# Electron snapshot — pre-Tauri migration

- Tag: electron-pre-tauri
- Electron version: 40.8.0
- Test count at baseline: 36 total, 30 pass, 6 fail (pre-existing failures unrelated to migration)
- Pre-existing failures: layout min-height test, zoom rem tests (x3), size preset test, projector calibration test
- Known issue: portable .exe takes multiple clicks + 2 min white screen on Win10 + Defender.
- Rollback procedure: `git checkout electron-pre-tauri`, run `npm install`, run `npm run dist:win`.
