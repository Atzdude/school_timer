# Hall Display + Setup UI Overhaul (web app)

Source: audit + /impeccable:critique + ui-ux-pro-max checklist (2026-09-23 session).
Scope: `app/index.html` (web version). `timer_fixed_v2.html` is kept byte-identical afterwards.

## Design contract
- Two modes. **Setup** (light paper page, teacher tools) and **Hall** (`presentation-mode`: dark,
  edge-to-edge, one-line header strip, no scrolling).
- Timer cards look the same in both modes: coloured name bar + dark digit panel.
- Digits: Barlow Condensed 700, tabular. Format `H:MM:SS` when >= 1h, `MM:SS` below.
- Digit size is fitted by JS to the real box (uniform across cards), never guessed by breakpoints.
- Colour = state only on the digit panel: running (neutral), <=30 min (amber), <=5 min (red),
  ended (red + "TIME UP", slow pulse <=1Hz, none with reduced motion), paused (dim + hatch + "PAUSED").
  Every state also has a text pill (colour-blind safe).

## Tasks
1. Fonts: add Barlow Condensed 600/700 (local woff2, OFL). UI stays Source Sans; Playfair only for school name.
2. CSS rewrite: tokens, setup layout, card, hall layout, modals, guide, focus-visible, reduced motion.
3. HTML: header regroup (reading split button, Present, Lock, Help); card-size toolbar above grid;
   Back up / Restore moved into Saved sessions; action bar hierarchy (Clear All separated); toast region;
   full-screen reading-time overlay; bulk modal default-duration field.
4. JS layout engine: `layoutTimers()` picks columns/orientation that maximise digit size in Hall,
   fits digits + names, aligns name blocks per grid, relayouts on resize / font load / format change.
5. JS correctness: strict `parseTimeString` ("2 hours", "1.5h", "2h 30min"); bulk parser splits on last
   separator + per-line errors; Lock blocks Space/P/R with toast; `\bib\b` exam type; session delete by index +
   overwrite confirm; import no longer duplicates or gets overwritten by beforeunload; Esc cancels renames;
   quick durations fill the form instead of opening a prompt; duration kept after add; Enter confirms dialogs.
6. Card UX: status pill, always-visible play/pause (setup), edit drawer with labelled H/M/S, grouped actions,
   Delete separated, named colour swatches.
7. Guide text matches real labels/behaviour.
8. Tests: update e2e to new contract (format, no-scroll hall fit); add parser/lock/format tests. All green.
9. Visual verification at 1280x720, 1366x768, 1920x1080 with 1-7 timers; sync `timer_fixed_v2.html`; commit.
