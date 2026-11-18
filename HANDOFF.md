# Varu: handoff

Moved from a Claude chat session (18 Nov 2026) to Claude Code. Read this, then README.md.

## Goal

Arthur and a friend (both at Rocca al Mare Kool, RAM) are building an app that shows each student how many lessons they can still miss per subject before hitting the school's absence limit.

- Phase 1 (now): RAM students. RAM rule: 25% or more of a subject's lessons missed in the grading window = automatic MH (mitte hinnatud). Source: RAM hindamisjuhend 2026/27 p 3.1 (not publicly online, not yet verified against the real document).
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

## Current state (v0.1.0)

Done and working:
- React 18 + Vite 5 + TypeScript + Tailwind 4.1 + vite-plugin-pwa. Estonian UI, dark-first theme.
- `src/core/` pure TS logic (no DOM, meant to be reused in a native app): date-based lesson counting from timetable segments, holidays, baseline counts, integer-math limits (fractions, "gte" vs "gt" mode), day capacity, what-if preview, paste parser, share codes.
- Screens: onboarding (RAM 9.b template or blank with school preset), Ülevaade (overview), Lisa (log + preview), Ajalugu (history + paste import), Seaded (rule, window, subjects, timetable editor per period, holidays, share link/code, JSON backup, reset).
- Data in localStorage (`varu:v1`), per device. Share link: `#setup=<base64url>` carries the setup only, never absences.
- 9 vitest tests pass, `npm run build` passes, checked at 390px in dark and light.
- Live demo (Claude artifact, private): https://claude.ai/artifact/3aQno99kCeXiH8EXewvcyz. Share links don't work inside the artifact viewer (it strips `#key=value` hashes); copying the code does.

Known gaps / not yet tested:
- Paste importer has only been tested on made-up input, never a real Stuudium/eKool copy.
- RAM rule wording unverified; only the RAM 9.b template exists.
- No deploy yet (target: Vercel). Service worker only works once it's on real hosting.
- 7 school presets in `src/core/schools.ts` (research table in README). Their rules change yearly.
- Not done yet: i18n (ru/en), reminders, native app.

## Suggested next steps

1. Push to a GitHub repo and deploy to Vercel; check PWA install and offline on iPhone.
2. Get a real Stuudium absences copy from Arthur, add it as a test fixture, tune `importer.ts`.
3. Verify RAM hindamisjuhend p 3.1; let other RAM classes enter their timetable and share it.
4. Native: Expo app reusing `src/core`, or Capacitor around the PWA as a quick first step.

## Conventions

- Keep `src/core` free of React/DOM imports.
- Never use em dashes in UI copy or docs; no emojis.
- Run `npm test` and `npm run build` before calling something done.
