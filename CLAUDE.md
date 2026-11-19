# Varu

Absence-limit tracker PWA for Estonian students (RAM first). Read HANDOFF.md for context and status.

- Stack: React 18, Vite 5, TypeScript, Tailwind 4.1, vite-plugin-pwa, vitest.
- `src/core/` is pure TypeScript (no React/DOM), reused later by a native app. Keep it that way.
- UI language is Estonian. No em dashes, no emojis in copy or docs.
- Before saying done: `npm test` and `npm run build` must pass. For UI changes also run `npm run test:e2e` (Playwright browser tests in `e2e/`, uses the installed Google Chrome) and add a test when you add a flow.
