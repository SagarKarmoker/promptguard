# PromptGuard — LLM Gateway, Semantic Caching & Rate-Limiter

**Product pitch:** "Cloudflare for LLM API calls and GenAI applications."

**Backend:** TypeScript / NestJS (see `AGENTS.md` for engineering rules).

---

## 1. Problem Statement

Companies integrating OpenAI / Anthropic / other LLM providers face:

1. **Exploding API costs** from redundant, semantically-identical prompt queries.
2. **Unhandled rate limits** — upstream 429s leak to end users.
3. **Slow latency** — no cache layer exists for LLM completions.
4. **Prompt injection vulnerabilities** — payloads are proxied to upstream models unfiltered.

Teams need one drop-in proxy that sits between their application and the LLM provider.

## 2. Goals

- Drop-in reverse proxy: change base URL, keep request/response shape identical to the upstream provider.
- Cut LLM spend ≥ 30% on workloads with repeated queries via semantic caching.
- Enforce per-tenant, per-user and per-API-key cost/token budgets in real time.
- Block jailbreak / prompt-injection payloads before they reach the upstream model.
- Transparently forward streaming responses (SSE) without buffering the whole completion.

## 3. Non-Goals (v1)

- Hosting or fine-tuning models.
- A self-service dashboard (v1 ships an admin API; UI comes later).
- Fine-grained per-prompt analytics/observability UI (metrics export only).
- Multi-cloud LLM load balancing beyond simple provider routing.

## 4. Personas

| Persona | Description | Primary need |
| --- | --- | --- |
| Platform engineer | Integrates PromptGuard in front of OpenAI/Anthropic | Zero-friction drop-in, provider compatibility |
| Finance / ops owner | Pays the API bill | Hard spend caps, cost visibility |
| Security engineer | Responsible for AI safety | Injection filtering, audit trail |
| Application developer | Builds the GenAI app | Cache hits without changing prompts, streaming that just works |

## 5. Key Features

### 5.1 Vector-Based Semantic Caching

- On each request, compute an embedding of the incoming prompt via the configured embedding model.
- Store `{prompt embedding, completion, model, tenantId}` entries in a vector database (**Qdrant** or **pgvector** — configurable driver behind a repository interface).
- Lookup rule: nearest neighbor with **cosine similarity > threshold (default 0.95)** **and** same target model **and** same tenant → return cached completion.
- Near-hits (threshold configurable per tenant between 0.80–0.99) are optionally rewritten as cache "hints" in response headers.
- Cache **TTL** (default 24h) and **invalidation** per tenant; `PURGE` allows explicit eviction by hash, model, or tenant.
- Normalized cache keys: whitespace/case normalization + stable hash = strategic cache segment for exact-match fast path before vector search.

### 5.2 Cost & Rate Governance

- **Multi-tenant token buckets** persisted in **Redis**, keyed by `tenant → user / api-key`.
- Tracks per key/window:
  - requests per minute,
  - tokens per minute (input + estimated output),
  - USD spend per day/month.
- Actual token counts and cost are reconciled after each response from upstream usage stats; the request-time estimate is provisional.
- Behavior at limit:
  - `429` with `Retry-After` + structured error body,
  - or configurable **grace mode** (e.g., allow 10% overage; flag in response headers).
- Providers return their real rate-limit headers; PromptGuard translates them per tenant and collapses visible upstream limits into its own buckets.

### 5.3 Prompt Injection Filter

- Runs **before** the cache lookup and **before** proxying upstream.
- Two-stage detection:
  1. **Regex rule pack** — known jailbreak patterns, instruction-override phrasing, role-prompt attempts ("ignore previous instructions", system-tag spoofing, etc.).
  2. **Lightweight classifier** — small local model/score heuristics; score above threshold ⇒ block.
- Actions (configurable per tenant, default `block`):
  - `allow` (annotate only), `redact` (strip matched segments), `block` (return `422` with reason code, no upstream spend).
- Findings are appended to the audit event stream (exportable later as JSONL/webhook).

### 5.4 Reverse Proxy & Streaming

- Forwards requests to the upstream provider (path/verb/body preserved; provider-adapter normalizes the few differing endpoints).
- **Streaming** (SSE) responses are piped chunk-by-chunk — no whole-body buffering, latency added ≤ 5ms.
- Retries/backoff on transient upstream errors (`5xx`, connection reset) with **jittered exponential backoff**; retries only allowed for non-streaming requests or until first SSE chunk.
- Automatic **circuit breaker** per provider on error-rate spikes.
- Non-streaming responses are cached after completion; streaming responses can optionally be reassembled to populate the cache.

## 6. Backend Architecture

```
Client App
   │  (OpenAI-compatible HTTP)
   ▼
┌───────────────────────────────────────────────┐
│ PromptGuard (NestJS)                          │
│                                               │
│  Auth middleware (API key → tenant/user)      │
│    → Injection filter middleware              │
│    → Rate limit / cost guard (Redis buckets)  │
│    → Cache lookup (exact hash → vector search)│
│    → Proxy module (provider adapter)          │
│         ├── SSE stream forwarding             │
│         ├── retry + circuit breaker           │
│         └── usage reconciliation              │
│                                               │
│  Vector cache: Qdrant | pgvector              │
│  Rate data:    Redis                          │
│  Audit log:    event stream (JSONL/webhook)   │
└───────────────────────────────────────────────┘
   ▼
Upstream LLM API (OpenAI / Anthropic / …)
```

- **Module boundaries (SOLID):**
  - `auth` — API-key/tenant resolution, no business logic.
  - `injection-filter` — detector interface; regex + classifier are interchangeable strategies.
  - `ratelimit` — limiter interface over Redis; per-tenant policy objects.
  - `cache` — `CacheRepository` port; Qdrant / pgvector adapters; embedding provider port.
  - `proxy` — `ProviderAdapter` port per upstream (OpenAI, Anthropic, generic OpenAI-compatible).
  - `audit` — event emitter; pluggable sinks.
- Containerization: a single `docker-compose.yml` runs PromptGuard + Redis + Qdrant for local dev.

## 7. API Surface (v1)

| Endpoint | Purpose |
| --- | --- |
| `ANY /v1/*` | OpenAI-compatible proxy (chat completions, completions, embeddings) |
| `GET /admin/tenants/:id/quota` | Effective quotas/limits |
| `PUT /admin/tenants/:id/policy` | Per-tenant policy: cache threshold/TTL, injection action, grace mode |
| `POST /admin/cache/purge` | Invalidate cache (by hash/model/tenant) |
| `GET /admin/metrics` | Prometheus-format metrics |
| `GET /health` and `GET /health/ready` | Liveness / readiness (checks Redis + vector store) |

Response headers added by PromptGuard:
`X-PG-Cache` (`hit|miss|hint`), `X-PG-Request-Id`, `X-PG-Quota-Remaining`, `X-PG-Retry-After` (limits only).

## 8. Success Metrics

| Metric | Target |
| --- | --- |
| Cache hit rate on repeat-query workloads | ≥ 40% after 1 week warm |
| Added per-request latency (non-blocking path) | < 5 ms p50 on hit path |
| Proxy overhead streaming first chunk | < 5 ms |
| Injection filter precision on red-team suite | ≥ 95% |
| Injection filter false-block rate | ≤ 2% |
| Cost reduction reported by tenants | ≥ 30% |
| Upstream error bookkeeping accuracy | 100% of spend reconciled within 60 s |

## 9. Milestones

| Milestone | Scope |
| --- | --- |
| M1 — Proxy core | Auth, reverse proxy, SSE forwarding, health endpoints |
| M2 — Governance | Redis token buckets, 429 handling, admin quota API |
| M3 — Injection filter | Regex rule pack, classifier port + default impl, audit events |
| M4 — Semantic cache | Embedding provider port, exact-hash fast path, Qdrant adapter, purge API |
| M5 — Hardening | Metrics export, e2e suite, docker-compose demo, response reassembly caching |

## 10. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Semantically-similar ≠ answerable-similar (bad hits at lower thresholds) | Strict default threshold 0.95; hint-only mode below; per-tenant tuning |
| Injection classifier latency on hot path | Classify in parallel with cache lookup; classifier is optional and async-flaggable |
| Provider response-shape drift | Provider adapters + contract tests against recorded fixtures |
| Vector store scaling cost | Exact-hash pre-filter first; only vector-search misses |
| Spend estimate divergence (streaming, unknown tokens) | Usage reconciliation pass; drift monitoring per tenant |
