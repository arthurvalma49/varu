# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable PWA, used almost entirely on iPhones from the home screen. A native app may come later and will reuse `src/core`.

## Users

Rocca al Mare Kool (RAM) students, any class (põhikool and gümnaasium, roughly 13 to 18). Built by two RAM students for themselves first. Each student uses it alone on their own phone; classmates share a class setup (timetable and rule) through a link or code, never their absences.

Other Estonian schools are a later phase (presets already exist in `src/core/schools.ts`), not the current audience.

## Product Purpose

Tell a student how many more lessons they can miss in each subject before hitting the school's absence limit, so they never lose a grade to it by accident. RAM rule: missing 25% or more of a subject's lessons in the grading window means an automatic MH (mitte hinnatud). Success: a student can answer "can I skip this?" in a few seconds, and nobody who uses Varu gets an MH they did not see coming.

## Positioning

Stuudium and eKool record absences after the fact and show percentages of lessons held so far. Varu counts against the whole grading window's lessons from the real timetable (paaristund, iseõpe, holidays, period changes) and answers forward-looking questions: can I skip this lesson, this day, that trip.

## Operating Context

The moments that matter, from the users:
- Right before a lesson they do not like: "can I skip this one?" A glance, often one-handed, between lessons.
- The evening before: "can I skip tomorrow?"
- Planning ahead: trips, competitions, appointments weeks away.

Data entry is manual logging plus paste import from Stuudium/eKool. No automatic sync (decided: fragile and unofficial). Data stays on the device (localStorage); backup is a JSON file.

## Capabilities and Constraints

- Guided setup (school, class, subjects, tap-built timetable, starting absences) or a classmate's share link/code; a ready RAM 9.b template.
- Overview verdict for the next free school day, per-subject varu, weekday capacity grid, one-tap "Täna puudun", planned absences, history with edit and undo, paste import.
- `src/core/` stays pure TypeScript with no React or DOM.
- UI language is Estonian. No em dashes and no emojis in copy or docs.
- The timetable stores lesson order (slots), not clock times.
- A first-run intro explains what Varu does, the rule and how varu is counted (requested by the user).

## Brand Commitments

- Name: undecided (18 Nov 2026). The user asked to keep the app without a name for now: no product name in the UI copy. "Varu" remains only as the working repo name and the home-screen label until a name is chosen.
- Voice: "can I skip?" An honest friend for the student's own use, blunt at the limit, never moralizing about attendance. Not framed for teachers or parents.
- Personality (chosen 18 Nov 2026): cheeky friend. A bit of humour in small places (empty states, toasts), always clear at the limit.
- Branding is deferred (18 Nov 2026): no name, no icon yet. Rejected so far, do not re-propose: round 1 (a day's lessons with one empty slot, a ticket, a fuel gauge, a calendar with a check: "not unique nor recognisable") and round 2 (tally marks with a slash, an empty tipped-back chair, a door ajar with light, a wink face). Next round should start from what the user names as icons they love.
- Visual standard (chosen 18 Nov 2026): the iOS standard, executed straight. It should sit alongside Apple's own apps (Weather, Fitness, Health): system type, grouped lists, native-feeling controls. Small distinctive details may be added later on top, never a costume.

## Evidence on Hand

- The RAM 9.b template (`src/core/templates.ts`) is real class data from the original "Puudumiste arvestus 9.b" tool.
- School rules in `src/core/schools.ts` link their sources; the RAM rule (hindamisjuhend 2026/27 p 3.1) is not yet verified against the document.
- No real Stuudium paste sample yet. No users, testimonials or usage numbers exist; do not invent any.

## Product Principles

1. Answer the question the student is actually asking, in their words, before showing any numbers.
2. Never let a student be wrong in the dangerous direction: when unsure, count conservatively.
3. Fast at the moment of need: the main answer is visible without scrolling or typing.
4. One student's absences never leave their phone.
5. Setting up a class should happen once; everyone else joins by link.

## Accessibility & Inclusion

Teen users on phones, often outdoors or in bright corridors and dark bedrooms: readable in both light and dark, 44pt touch targets, meaning never by color alone.
