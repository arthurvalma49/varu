# Varu: handoff

Moved from a Claude chat session (18 Nov 2026) to Claude Code. Read this, then README.md.

## Goal

Arthur and a friend (both at Rocca al Mare Kool, RAM) are building an app that shows each student how many lessons they can still miss per subject before hitting the school's absence limit.

- Phase 1 (now): RAM students. RAM rule: 25% or more of a subject's lessons missed in the grading window = MH (mitte hinnatud) until the õppenõukogu decides; usually lifted for justified absences, otherwise extra work or another measure (confirmed by a RAM student, Nov 2026). Source: RAM hindamisjuhend 2026/27 p 3.1 (not publicly online, not yet verified against the real document).
- Phase 2: any Estonian student (school presets + custom rules).
- Platform: installable PWA now, native mobile app later.
- Data entry: manual logging plus paste import from Stuudium/eKool. No auto-sync (decided: fragile and unofficial).

## Origin

The friend's original was a single HTML page ("Puudumiste arvestus 9.b"), hardcoded for RAM 9.b:
- Subjects with 1. periood lesson counts typed in by hand (e.g. Matemaatika 35).
- 2. periood timetable (02.11–18.12.2026) hardcoded; Tuesday = self-study (iseõpe) that counts toward totals as attendance.
- Half-year = P1 (7 wk) + P2 (7 wk) + N weeks of P3 (default 3, window ends 25.01.2027).
- maxAllowed = ceil(T/4) - 1.
- Kunst and tööõpetus excluded; muusika graded only at year end; klassijuhataja tund not graded.
All of this is now the `ram9bTemplate()` in `src/core/templates.ts`. Tests confirm Varu gives the same totals and limits for all 14 subjects.

## Current state (18 Nov 2026)

Live at https://varu-amber.vercel.app (Vercel project `varu`, GitHub `arthurvalma49/varu`, private). Pushing to `main` deploys to production. Vercel rejects commits whose author email is not on the GitHub account, so the repo uses the GitHub noreply address.

Done and working:
- React 18 + Vite 5 + TypeScript + Tailwind 4.1 + vite-plugin-pwa. Estonian UI, dark-first with a light theme. Copy tone: "can I skip?", an honest friend for students' own use.
- `src/core/` pure TS: date-based lesson counting, integer-math limits, four-level status (ok, warn, edge = 0 left, over), planned absences (entries dated after today count once the day passes), day verdicts ("can I skip the next school day?"), guided setup builder (`setup.ts`) with national 2026/27 school breaks, paste parser, share codes.
- Guided setup: school and class, tap subjects, build each weekday by tapping subjects in order, starting absences. The draft survives a reload. Classmates can paste a share code or open a link instead.
- Overview: verdict sentence for the next free school day, every subject at 0 named with its next lesson date, one-tap "Täna puudun", grouped subject list, advisory subjects ("Vähem tähtis") never headline.
- Lisa: Täna/Homme chips, a sticky verdict and save bar, a red action when saving goes over the limit. Ajalugu: edit, and delete with undo. Seaded: the same tap-to-build timetable editor, holidays shown as ranges plus a one-tap national-breaks button.
- EduPage import (`src/core/edupage.ts`, UI `src/ui/EduImport.tsx`, proxy `api/edupage.js` as a Vercel function because EduPage sends no CORS headers). RAM is at ramkool.edupage.org; at least 62 Estonian schools publish timetables there. The import reads every timetable published in the grading window (RAM: I and II periood) as separate periods, maps "(i)" subjects to iseõpe, and asks the student for their group in each split. Tested against real fixtures (Pae 9.a, RAM 9.b). EduPage's endpoints are unofficial and may change.
- EduPage often refuses connections from Vercel's cloud servers (timeouts from both arn1 and fra1, while home connections work), so the live proxy is best-effort. RAM therefore ships a static snapshot in `public/edupage/ramkool/`, which the import reads first. **When RAM publishes a new period (e.g. III periood in January), run `node scripts/edupage-snapshot.mjs ramkool` from a home machine, commit and push.** Other schools use the live proxy.
- Lesson times: setups can carry `periodTimes` (bell times by lesson number; from EduPage, RAM built in). Täna then shows times, marks the current or next lesson live, and rolls over to tomorrow after the last lesson ends. Without times it falls back to 15:00.
- Lisa "Mitu päeva": plan a date range in one go (one entry per school day, one undo).
- Cancelled lessons ("jääb ära"): `setup.cancelled` by date and subject. `lessonsOn` subtracts them, so totals (and possibly the allowed absences) drop; they are not absences. Marked from Täna (three-dot menu per lesson, or the whole day), listed in Seaded → Vabad päevad. They are personal: never included in share links or codes, and kept when a share link replaces the setup.
- Double lessons can be skipped one hour at a time (Täna asks which half; Lisa has an hour chip).
- EduPage groups: only splits whose groups meet at different times or for different subjects are asked; each option shows its lessons ("Hispaania keel · T, N"). RAM 9.b: one question instead of five.
- Testrežiim (Seaded → Testimine): demo data from `src/core/demo.ts`; the real data is parked in localStorage `varu:real` and restored on exit.
- Kept deliberately simple (target users skip school and will not put effort into an app): one main screen, Täna, with a gear (Seaded) and a + button (Lisa sheet); no tab bar. Ajalugu opens from the top of Seaded. Täna is the verdict card, the day's lessons with Puudun, and one Ained list. Lisa is only "I miss these" (no cancel mode, no preview list, no note). All settings and Varukoopia stay.
- Apple-style interaction (kit.tsx): `Sheet` (swipe down to close, page behind recedes, rendered in a portal), `ActionSheet`, `SwipeRow` (Mail-style swipe actions), `useLongPress` (context menu), Settings-style coloured icons, Apple empty states. Subject rows open `SubjectDetail`. Seaded pages push and pop.
- Onboarding is short: start screen (Alusta, "Mul on kood", RAM 9.b näidis), then school + EduPage import on one screen, then the optional "Juba puudunud?" counts. Schools without EduPage take the manual path (Ained, then the weekly timetable) via "Kool ei kasuta EduPage'i? Sisesta käsitsi". Class comes from the import; period dates from the school (editable in Seaded).
- 33 vitest tests. `npm test` and `npm run build` pass.

Known gaps:
- The paste importer has never been tested on a real Stuudium/eKool copy.
- The RAM rule wording is unverified. Private schools may have different breaks than the national calendar.
- Not done: reminders the evening before, i18n, native app.

## Suggested next steps

1. Get a real Stuudium absences copy from Arthur, add it as a test fixture, tune `importer.ts`.
2. Verify RAM hindamisjuhend p 3.1.
3. Evening-before warning (web push for installed PWAs on iOS 16.4+).
4. Native: Expo app reusing `src/core`, or Capacitor around the PWA.

## Conventions

- Keep `src/core` free of React/DOM imports.
- Never use em dashes in UI copy or docs; no emojis.
- Run `npm test` and `npm run build` before calling something done.

## Motion and touch feedback
- One motion system in `src/index.css`: Apple springs (WWDC23 "Animate with springs", duration + bounce) sampled into CSS `linear()` as `--spring-smooth|snappy|bouncy|quick` with matching `--dur-*`. Use these, not ad-hoc cubic-beziers.
- Touch feedback as in UIKit: `.press` (row highlight), `.tap` (dim), `.glass-btn` / `.tab-btn` (Liquid Glass flex: scale up and brighten, spring back). Highlights appear instantly on touch-down and fade on release. `main.tsx` adds an empty touchstart listener because iOS Safari otherwise never applies `:active`.
- Sheets slide up over a dimmed page; the page behind no longer zooms out. Segmented and tab pills slide; the switch knob stretches while held.
- Haptics (tested on a real iPhone): iOS only plays a haptic when the user's own tap flips a native `<input type=checkbox switch>`; flipping it from code does nothing. So `HapticButton` (kit.tsx) is a label with a hidden switch inside, `Button haptic` uses it, and `Switch` is a real native switch. Used on Puudun, Salvesta/Planeeri, swipe and action-sheet actions, calendar days. `haptics.ts` is Android vibrate only.
- Sheets and action sheets start below the status bar: any layer appearing over the top edge made Safari re-tint the status bar (brief flash, seen on device in every variant).

## Tests
- `npm test`: unit tests for `src/core` (vitest, `src/**/*.test.ts` only).
- `npm run test:e2e`: Playwright browser tests in `e2e/` against the production build at phone size, with a fixed clock (Tallinn time) on the RAM 9.b example. Covers onboarding, EduPage import (static snapshot), Puudun once + undo, half of a double lesson, Tund jääb ära + Taasta, day rollover and self-study days, Lisa skipping logged lessons, range by tap and by drag, Juba puudutud tunnid, install hint. Uses the installed Chrome (`channel: "chrome"`), no browser download.

## Install hint
- `src/ui/InstallHint.tsx`: on iPhone in a browser tab (not the home-screen app) explains Jaga, then "Lisa avakuvale"; on Android uses the browser's install prompt. Shown on the first onboarding screen (says to install before setting up, since browser data does not carry over) and on Täna. "Hiljem" hides it for 7 days.

