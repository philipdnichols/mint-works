# Mint Works! - Codex Instructions

## Before Every Commit and Push

Always run the full CI suite locally before pushing:

```bash
npm run lint
npm run format:check
npm run test:coverage
npm run test:e2e
```

Never push without running all four. If any step fails, fix it before pushing.

Note: The workflow uses `concurrency: cancel-in-progress: true`. Pushing a second commit while the first run is still in-flight cancels it.

## Keeping Documentation Updated

- `GAME.md` - update whenever rules are corrected, mechanics are added, or the implementation diverges
- `AGENTS.md` - update whenever project conventions change
- `TODO.md` - track high-level tasks and user-reported follow-ups (not internal execution checklists)

## Project Conventions

- Use `npm run test:coverage` (not `npm test`)
- Run `npm run format` before `format:check`
- TypeScript strict mode: no `any`, no unused locals or parameters
