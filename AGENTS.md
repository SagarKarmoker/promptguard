# AGENTS.md — Engineering Guide for PromptGuard

Product details: @PRD.md

## Identity

- **Project:** PromptGuard — LLM gateway, semantic cache, rate-limiter, prompt-injection filter (see `PRD.md`).
- **Repository layout:** monorepo; all backend code lives under `backend/`.

## Non-Negotiable Rules

- **Language:** TypeScript (strict mode; no implicit `any`, no editor-disappeared errors).
- **Backend:** NestJS — feature modules per bounded context (`auth`, `injection-filter`, `ratelimit`, `cache`, `proxy`, `audit`).
- **Package manager:** pnpm only (no npm/yarn lockfiles get committed).
- **Architecture:** SOLID principles and LLD practices — ports/adapters at module boundaries (e.g., `CacheRepository`, `ProviderAdapter`, `RateLimiter`, `InjectionDetector` are interfaces), dependency inversion over direct vendor imports (Qdrant, pgvector, Redis, OpenAI, Anthropic are swappable implementations).
- **LLD discipline:** each class/type has a single responsibility; actions and side effects live behind interfaces; domain decisions (thresholds, block/redact/allow) are policy objects, not scattered conditionals; explicit DTOs and error codes at every boundary.
- **Commits:** max 3 lines, author Sagar Karmoker, **no co-authored-by lines of any kind**.

## Testing

- Unit tests with **Vitest** (`pnpm test`), e2e via `vitest.config.e2e.ts` (`pnpm test:e2e`), coverage via `pnpm test:cov`.
- Mock the ports (vector store, Redis, upstream HTTP) in unit tests; real dependencies are for e2e.
- Every module ships with tests before it is considered done.

## Commands (run inside `backend/`)

| Command | Purpose |
| --- | --- |
| `pnpm install` | install dependencies |
| `pnpm start:dev` | dev server with watch |
| `pnpm build` / `pnpm start:prod` | production build/run |
| `pnpm lint` | oxlint (type-aware) on `src/` and `test/` |
| `pnpm test`, `pnpm test:e2e`, `pnpm test:cov` | test suites |
| `pnpm format` | prettier across `src/` and `test/` |

## Style & Conventions

- Prettier config in `backend/.prettierrc` is the source of truth for formatting.
- Lint config: `backend/.oxlintrc.json`.
- Add Stripe-grade error semantics: structured error bodies and stable codes (`429` + `Retry-After`, `422` on injection block) exactly as specified in the PRD.
- Response headers: `X-PG-Cache`, `X-PG-Request-Id`, `X-PG-Quota-Remaining` — never change these names without a PRD update.
- No secrets in code; config via environment variables with typed config module.
- Keep module boundaries honest: one module must not import another module's internals — go through its service/provider interfaces.

## Deliverable Definition of Done

1. Feature implements the PRD behavior.
2. Unit + e2e tests pass (`pnpm test` and `pnpm test:e2e`).
3. `pnpm lint` and `pnpm build` clean.
4. Committed with the ≤3-line message per the rules above.
