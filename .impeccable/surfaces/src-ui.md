---
version: 1
slug: "src-ui"
primary_target: "src/ui"
related_targets: ["src/App.tsx"]
---

# Varu app (all tabs, intro, setup)

Scope: the whole installable PWA, mode Operate. Audience: RAM students on iPhone. Jobs: "can I skip this lesson / tomorrow / that trip?", log absences, set up a class once.

## Direction contract

THESIS: Varu is an Apple-grade iPhone utility: the answer to "can I skip?" in system type at the top, everything else in inset grouped lists. Refuses the custom card dashboard with pills it replaced.

OWN-WORLD: iOS system palette (grouped background #F2F2F7 / #000, cells #FFF / #1C1C1E, label, secondary label, separators), systemBlue as the only tint, systemRed / Orange / Green only for state. System font stack (SF on iPhone), large titles, 44pt rows with trailing values and chevrons, segmented controls, translucent tab bar with filled glyphs.

STORY: A student opens the app before a lesson, reads today's lessons with Võid / Ei beside each, taps "Puudun" on one, sees undo. New users see a short welcome intro, then pick: classmate link, set up, or RAM 9.b.

FIRST VIEWPORT: Large title "Varu" with class subtitle; one grouped cell with the verdict sentence for the next free day; section "Täna" listing lessons with trailing status; tab bar Täna, Lisa, Ajalugu, Seaded.

FORM: canon (the iOS standard, user-chosen standing exit), not on the ranked list. seed:d0cca02170bb7a5f

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
