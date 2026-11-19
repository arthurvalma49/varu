# Varu

How many lessons can you still miss per subject before hitting your school's absence limit?
Polished, multi-school version of the original RAM 9.b "Puudumiste arvestus" tool.

## Run

```bash
npm install
npm run dev      # local dev
npm test         # core logic tests
npm run build    # production build in dist/ (installable PWA, works offline)
```

Deploy `dist/` anywhere static (Vercel, Netlify, GitHub Pages). It's a PWA: on a phone, open the URL and "Add to Home Screen".

## What changed vs the original

| Original | Varu |
| --- | --- |
| RAM 9.b hardcoded | School presets + custom rule; RAM 9.b is a one-tap template |
| Totals = p1 + 7 × weekly + N × weekly | Totals counted by date from timetable segments, minus holidays (same numbers for RAM, verified in tests) |
| Fixed 25%, "≥" only | Any limit as an exact fraction (18%, 1/4, 1/3, 2/5, 1/2, custom), "reaching" vs "exceeding", automatic vs teacher decision |
| Timetable in code | Timetable editor per period, copy between periods, mark as assumed |
| Manual logging only | Plus paste import from Stuudium/eKool (tolerant parser, preview before import) |
| One person, Claude DB | Data stays on the device, JSON backup/restore, share class setup with a link or code |

## Structure

```
src/core/      pure TypeScript, no DOM: reuse as-is in a React Native / Expo app later
  types.ts       data model (Setup, Rule, Segment, Absence...)
  calc.ts        totals, maxAllowed (integer math), summary, day capacity, what-if preview
  importer.ts    paste parser
  schools.ts     researched school presets
  templates.ts   RAM 9.b template
  share.ts       share codes, validation
src/ui/        React screens (Ülevaade, Lisa, Ajalugu, Seaded, onboarding)
src/store.ts   localStorage persistence
```

## School research (Nov 2026)

| School | Limit | Fails when | Consequence | Source |
| --- | --- | --- | --- | --- |
| Rocca al Mare Kool | 25% | 25% or more | MH at the limit, provisional until the õppenõukogu decides; usually lifted for justified absences (hindamisjuhend 2026/27 p 3.1) | not public, verify |
| Oru Kool | 18% | 18% or more | Teacher may use a summative test (trimester) | [link](https://oru.edu.ee/wp-content/uploads/2025/01/HINDAMISJUHEND-2025.pdf) |
| Miina Härma Gümnaasium | 1/3 (or 10+ lessons) | 1/3 or more | Teacher may assign a whole-course test (gr 10–12) | [link](https://miinaharma.ee/failid/hindamisjuhend_01_09_2026.pdf) |
| Võru Gümnaasium | 1/3 | more than 1/3 | Teacher may change how the course is assessed | [link](https://voru.edu.ee/wp-content/uploads/2024/11/Lisa_5_Voru-Gumnaasiumi-opilase-hindamise-tingimused-ja-kord.pdf) |
| Emmaste Põhikool | 40% | 40% or more | Teacher may require a test on the whole period | [link](https://emmaste.edu.ee/sites/emmaste.edu.ee/files/2025-02/hindamisjuhend_okt.2024_0.pdf) |
| Tartu Forseliuse Kool | 50% | more than half (health reasons) | Teacher may leave the trimester grade unset | [link](https://tfk.tartu.ee/wp-content/uploads/2024/ainekavad/TFK%20hindamisjuhend%2024-25.pdf) |
| Kadrina Keskkool | 50% | more than 50% (excused) | Teacher may leave the course grade unset | [link](https://kadrina-kool.edu.ee/kadrina-new/wp-content/uploads/2024/05/hindamisjuhend_g.pdf) |

Checked with no percentage rule: Tallinna Prantsuse Lütseum, Hugo Treffneri Gümnaasium.

Takeaway: percentage rules are common, but limits vary from 18% to 50%, and RAM's MH at the limit (provisional, the õppenõukogu decides) is among the stricter ones. Most schools let the teacher decide. Rules change yearly, so presets link their source.

## Roadmap

1. Verify the RAM rule wording from the official hindamisjuhend, add other RAM classes as templates.
2. Test the paste importer on real Stuudium exports and tune the parser.
3. More school presets (crowdsourced via a "suggest your school" form).
4. Native app: Expo/React Native reusing `src/core` unchanged (or wrap this PWA with Capacitor as a quick first step).
5. Optional: reminders before a risky day, Russian/English UI.
