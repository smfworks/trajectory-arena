# Contributing to Trajectory Arena

## Development setup

```bash
git clone https://github.com/smfworks/trajectory-arena.git
cd trajectory-arena
npm ci
npm run dev
```

Use Node.js `>=22.12.0` and npm `11.9.0`.

## Engineering rules

- Validate external input at the boundary; TypeScript assertions are not runtime validation.
- Never construct storage paths from unchecked values.
- Preserve task → trajectory → run referential integrity.
- Keep rejected requests side-effect free.
- Use atomic writes and the storage transaction helpers for every persistent mutation.
- Do not execute imported commands or code.
- Keep UI controls keyboard accessible, labelled, responsive, and explicit about loading/error/empty states.
- Update README, architecture, operations, and changelog when contracts change.

## Test-first workflow

For correctness, storage, security, API, and replay changes:

1. Add the narrow regression test.
2. Run it and confirm it fails for the expected reason.
3. Implement the smallest root-cause fix.
4. Rerun the focused test.
5. Run the complete release matrix.

## Local quality gates

```bash
npm run format
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run audit
npx playwright install chromium
npm run test:e2e
```

The coverage gate enforces 80% lines/statements, 90% functions, and 68% branches across core libraries and API handlers.

## Storage testing

Storage tests must use a temporary `TRAJECTORY_DATA_DIR`; never use repository or operator data. Changes to persistence should cover applicable cases:

- malformed/corrupt JSON;
- traversal and symbolic links;
- write lock contention;
- partial/failing graph writes and rollback;
- task/trajectory/run references;
- delete lifecycle;
- import/export metric preservation;
- deterministic seeding;
- production configuration.

## API testing

Cover success and relevant `400`, `401`, `403`, `404`, `409`, `413`, `500`, and `503` behavior. Assert errors do not leak internal paths or exception text and that successful API responses are `no-store`.

## Browser testing

Playwright runs against `.next/standalone/server.js`, not the development server. Add representative workflow tests for UI behavior, keyboard access, failure states, mobile overflow, and navigation.

## Pull requests

- Keep commits reviewable and document architecture decisions.
- Include the reason, behavior change, security/storage impact, and verification commands.
- Do not merge with a red CI check, unresolved high/critical finding, or stale exact-commit review.
- New dependency exceptions must be documented; high/critical npm advisories block release.

See [SECURITY.md](SECURITY.md) for private vulnerability reports.
