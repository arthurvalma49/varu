# Varu

Absence-limit tracker PWA for Estonian students (RAM first). Read HANDOFF.md for context and status.

- Stack: React 18, Vite 5, TypeScript, Tailwind 4.1, vite-plugin-pwa, vitest.
- `src/core/` is pure TypeScript (no React/DOM), reused later by a native app. Keep it that way.
- UI language is Estonian. No em dashes, no emojis in copy or docs.
- Before saying done: `npm test` and `npm run build` must pass. For UI changes also run `npm run test:e2e` (Playwright browser tests in `e2e/`, uses the installed Google Chrome) and add a test when you add a flow.

## Working together (two people, two Claudes, one repo)

See CONTRIBUTING.md. In short:
- Never commit to `main` directly. Start from a fresh `main` (`git checkout main && git pull`), work on a branch named `<person>/<topic>`, push it and open a pull request with `gh pr create`. `main` is what is live (Vercel deploys it).
- Keep branches small and short-lived; merge `main` into your branch before opening the PR if it moved.
- The PR must pass the GitHub "Checks" workflow (unit tests, build, browser tests). Test on the phone with the Vercel preview link.
- When something important changes (a new flow, a product decision), update HANDOFF.md in the same PR so the other person's Claude knows.
- Before starting bigger work, check open Issues and PRs (`gh issue list`, `gh pr list`) so you don't both build the same thing.
