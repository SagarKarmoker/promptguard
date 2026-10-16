PromptGuard — LLM Gateway, Semantic Caching & Rate-Limiter
Product Pitch: "Cloudflare for LLM API calls and GenAI applications."

The Pain Point: Companies integrating OpenAI/Anthropic face exploding API costs due to redundant prompt queries, unhandled rate limits, slow latency, and prompt injection vulnerabilities.

Key Features:

Vector-Based Semantic Caching: Hashes incoming prompt embeddings into a vector database (e.g., Qdrant/pgvector). If a similar query was asked within a cosine similarity threshold (>0.95), returns the cached completion instantly.

Cost & Rate Governance: Multi-tenant token buckets tracking per-user or per-API-key spending and token limits in real-time.

Prompt Injection Filter: Regex and lightweight classifier middleware inspecting payloads for malicious jailbreak attempts before proxying to upstream LLM APIs.

Backend Architecture: Reverse proxying in Go/Node.js, vector similarity matching, streaming response forwarding (Server-Sent Events), Redis token management.