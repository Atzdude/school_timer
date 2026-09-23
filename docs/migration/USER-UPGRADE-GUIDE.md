# Upgrading from Electron timer to Tauri timer

## Before you uninstall the old app

1. Open your old (Electron) timer app on the school machine.
2. Click **Export** in the top-right of the header.
3. Save the backup file (`exam-timer-backup-*.json`, or `naisula-timer-backup-*.json` from older versions) somewhere safe (Desktop, USB stick, OneDrive).

## Uninstall / remove the old app

4. Uninstall the old timer app (Settings > Apps > timer > Uninstall),
   OR just delete the portable `.exe` if you were using the portable version.

## Install the new Tauri app

5. Install the new `timer-setup.exe` installer.
6. Open the new app from the Start Menu or Desktop shortcut.

## Restore your data

7. Click **Import** in the top-right of the header.
8. Pick the JSON file you saved in step 3.
9. You should see: "Import complete. Your data has been restored."

Your saved timers, favourite durations, session presets, and title will all be back.

---

**If you skip steps 2-3 and 7-8:** The new app starts blank. Your saved data stays in
the old install's data folder but is not readable by the new app. You can still go back
and export from the old Electron build if you have not yet deleted it.

**Boot time improvement:** The new app opens in under 3 seconds on Windows, even on first launch.
