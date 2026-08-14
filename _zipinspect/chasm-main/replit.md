# Claims Checker

Claims Checker compares public RWA marketing language with the project's official terms and surfaces unsupported or underqualified promises with side-by-side evidence.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/claims-checker/src/App.tsx` — the current single-page comparison workspace, deterministic screening rules, generic tokenized-asset example, and evidence report.
- `artifacts/claims-checker/src/index.css` — the Claims Checker visual system and responsive theme.
- `artifacts/api-server/` — shared API service scaffold, currently retained for future AI and X Layer endpoints.
- `attached_assets/` — uploaded hackathon brief screenshots.

## Architecture decisions

- The first proof of concept is local-first and deterministic, so a user can run the example without an AI provider or an API key.
- The product is generic at the interaction level; the example content is illustrative and the screening rules are written as reusable claim categories.
- Findings always preserve both source quotes and a plain-language explanation; the tool is a research screening layer, not legal advice.
- X Layer publication is intentionally deferred until the comparison output is stable enough to hash and record.

## Product

- Paste official terms and public marketing copy into separate source panels.
- Load a generic tokenized-asset demonstration case.
- Run a local screening pass for ownership language, liquidity claims, return promises, certainty, protection, and hands-off framing.
- Review a scored report with severity, confidence, quoted evidence, and investigator notes.

## User preferences

- Keep the product generic rather than hardcoding it to a single project.
- Prioritize the AI-RWA hackathon proof case first, then add X Layer publishing and live ecosystem research.

## Gotchas

- The Claims Checker web workflow provides `PORT` and `BASE_PATH`; use the managed workflow rather than starting Vite from the workspace root.
- The current report engine is explicitly labeled local/deterministic because the requested AI provider could not be connected in this build.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
