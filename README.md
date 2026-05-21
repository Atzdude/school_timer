# Naisula Exam Timer (Electron Desktop App)

This project packages `timer_fixed_v2.html` as a Windows desktop app.

## 1) Install Dependencies

```bash
npm install
```

## 2) Run Locally

```bash
npm start
```

## 3) Run Tests

```bash
npm test
```

The tests execute the inline JavaScript from `timer_fixed_v2.html` with a fake clock and storage layer. They cover the power-cut remembrance logic, clock fallback behavior, duration parsing, duplicate-ID prevention, presentation-mode done shelf visibility, long-title header layout, icon-only presentation controls, seven-second Keep Done flashing, and the `R` reading-time shortcut.

## 4) Build Windows x64 Distributables

Creates both:

- Installer (`.exe`, NSIS)
- Portable app (`.exe`, no install needed)

```bash
npm run dist:win
```

Output files are created in:

```text
dist/
```

The packaged app name is `timer` to avoid conflicting with existing Naisula desktop shortcuts.
