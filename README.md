# PromptGuard

> **Cloudflare for LLM API calls and GenAI applications** — an LLM gateway with semantic caching, cost/rate governance, and prompt-injection filtering.

PromptGuard sits between your application and LLM providers (OpenAI, Anthropic, any OpenAI-compatible API). Swap your base URL, keep the request/response shape, and get caching, spend controls, and prompt-security out of the box.

---

## Why

Teams integrating LLM APIs bleed money and trust:

| Pain | PromptGuard answer |
| --- | --- |
| Redundant, semantically-identical prompts re-billed every time | **Vector-based semantic caching** (cosine similarity > 0.95 → instant cached completion) |
| Exploding per-user/team/token costs | **Multi-tenant token buckets** — requests/min, tokens/min, USD/day limits backed by Redis |
| Jailbreak & prompt-injection payloads reaching your model | **Injection filter** (regex rule pack + lightweight classifier) run *before* proxying or caching |
| Upstream 429s / 5xx leaking into the app | Structured gateway errors, retried/normalized upstream limits |
| No streaming-safe proxy | **SSE chunk-by-chunk forwarding** — never buffers a whole completion |

## How it works

```
Client App (OpenAI-compatible HTTP)
   │
   ▼
┌────────────────────────────────────────────────┐
│ PromptGuard (NestJS)                           │
│  RequestId → Auth (API key → tenant)           │
│    → Injection filter (M3)                     │
│    → Rate limit / cost guard (M2)              │
│    → Cache lookup: exact hash → vector (M4)    │
│    → Proxy → upstream provider                 │
│         ├── SSE stream forwarding              │
│         └── structured error semantics         │
│                                                │
│  Redis (buckets)   Qdrant/pgvector (cache)     │
└────────────────────────────────────────────────┘
   │
   ▼
OpenAI · Anthropic · any OpenAI-compatible API
```

Everything is wired through **ports & adapters** (`UpstreamHttpClient`, `ProviderAdapter`, `TenantResolver`, `ReadinessCheck`), so Redis, Qdrant, pgvector and every provider are swappable implementations — see [`PRD.md`](./PRD.md) for the full architecture and roadmap.

## Quick start

```bash
git clone <repo-url> promptguard && cd promptguard
pnpm install --dir backend
```

Configure and run:

```bash
cd backend
export PG_API_KEYS="pgk_demo:tenant-a"      # gateway key → tenant
export PG_LLM_API_KEY="sk-..."              # upstream provider key
export PG_LLM_BASE_URL="https://api.openai.com"
pnpm start:dev
```

Point your OpenAI SDK at the gateway:

```ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'pgk_demo',                        // your PromptGuard gateway key
  baseURL: 'http://localhost:3000/v1',       // PromptGuard instead of api.openai.com
});

const res = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
  stream: true,                              // streams straight through PromptGuard
});
```

## Configuration

All configuration is environment-based — no secrets in code.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `PG_API_KEYS` | — | Comma-separated gateway keys: `key:tenant,key2:tenant2` |
| `PG_LLM_API_KEY` | — | Upstream provider API key |
| `PG_LLM_BASE_URL` | `https://api.openai.com` | Upstream provider base (origin only; `/v1` is appended) |
| `PG_LLM_TIMEOUT_MS` | `120000` | Upstream timeout per request |

## API surface

| Endpoint | Purpose |
| --- | --- |
| `ANY /v1/*` | OpenAI-compatible reverse proxy (chat, completions, embeddings) |
| `GET /health` | Liveness |
| `GET /health/ready` | Readiness (failures → `503` with per-check detail) |

Admin endpoints for quotas, cache purge and metrics land with milestones M2–M5 — see the [PRD milestones](./PRD.md#9-milestones).

### Response headers

| Header | Meaning |
| --- | --- |
| `X-PG-Request-Id` | Stable gateway request id |
| `X-PG-Cache` | `hit \| miss \| hint` (from M4) |
| `X-PG-Quota-Remaining` | Remaining budget snapshot (from M2) |

### Error semantics

Errors are structured — never ad-hoc text:

```json
{ "error": { "code": "unauthorized", "message": "missing or invalid gateway API key" } }
```

| Status | Code | When |
| --- | --- | --- |
| `401` | `unauthorized` | Missing/unknown gateway key |
| `422` | injection reasons | Prompt-injection block (from M3) |
| `429` | rate codes | Quota exhausted, `Retry-After` attached (from M2) |
| `502` | `upstream_unavailable` | Upstream unreachable |
| `503` | `upstream_not_configured` | Gateway missing upstream key |
| `504` | `upstream_timeout` | Upstream exceeded `PG_LLM_TIMEOUT_MS` |

## Development

```bash
cd backend
pnpm start:dev        # dev server with watch
pnpm test             # unit tests (Vitest) — ports mocked, no network
pnpm test:e2e         # full HTTP path tests (supertest, fake upstream)
pnpm test:cov         # coverage
pnpm lint             # oxlint, type-aware
pnpm build            # production build
```

### Project layout

```
backend/src/
├── common/    # error vocabulary, per-request context, middleware kernel
├── config/    # typed env configuration
├── auth/      # tenant resolution (port + env adapter + middleware)
├── proxy/     # upstream HTTP port, provider adapters, proxy service/controller
└── health/    # liveness + readiness checks (port-based)
```

Every module boundary is an interface — implementations are swappable by design (SOLID/LLD), and tests mock the ports rather than the network.

## Roadmap

| Milestone | Scope | Status |
| --- | --- | --- |
| M1 | Proxy core: auth, forwarding, SSE, health | ✅ Done |
| M2 | Governance: Redis token buckets, 429 handling, admin quota API | ⏳ |
| M3 | Injection filter: rule pack, classifier, audit events | ⏳ |
| M4 | Semantic cache: embeddings, exact-hash fast path, Qdrant, purge API | ⏳ |
| M5 | Hardening: metrics export, e2e suite, docker-compose demo | ⏳ |

## License

UNLICENSED — all rights reserved.
