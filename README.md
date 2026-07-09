# Hungry Hungry Tippo

Starter full-stack agentic workflow example using:

- Node.js + Express API with service/controller/repository separation
- React + Material UI frontend
- Claude via the official Anthropic TypeScript SDK
- Postgres with `pgvector` ready for pass 2 RAG storage
- Prompt logging in Postgres
- First-pass agentic orchestration with optional Claude web search augmentation
- Keycloak-protected prompt workflow UI and API

## Project Layout

```text
apps/api              Express API, migrations, Claude integration
apps/web              React/Vite/Material UI frontend
packages/contracts    Shared request/response schemas and TypeScript types
```

## First Run

```sh
cp .env.example .env
make install
make db-up
make keycloak-up
make migrate
make dev
```

The web app runs at `http://localhost:5173` and the API at `http://localhost:3001`.
Swagger API docs are available at `http://localhost:3001/api/docs`, with the raw
OpenAPI document at `http://localhost:3001/api/docs/openapi.json`.

Set `ANTHROPIC_API_KEY` in `.env` before submitting prompts. The API creates a
`prompt_logs` row before every Claude call and updates it with response, latency,
token usage, or error details.

The prompt workflow is protected by Keycloak. Local defaults:

```text
Keycloak: http://localhost:8081
Admin console: http://localhost:8081/admin
Master admin: admin / admin
App admin: admin / admin
```

See [docs/keycloak.md](docs/keycloak.md) for realm, client, and provisioning details.

## Prompt Orchestration

The prompt endpoint accepts an `augmentationMode`:

- `auto`: default. The conductor enables web search when the prompt looks current,
  time-sensitive, documentation-specific, or internet-dependent.
- `web_search`: force Claude's server-side web search tool before the final answer.
- `direct`: bypass retrieval tools and answer directly.

When web search is applied, the API adds Claude's `web_search_20250305` server tool,
forces one search before the final answer, returns citations in the response, and
stores workflow metadata in `prompt_logs.metadata`.

The exact orchestrated prompt envelope is stored in `prompt_logs.augmented_prompt`.
For web-search responses, cited source URLs are also upserted into `rag_documents`
and cited snippets are appended to `rag_chunks` with `embedding = null` until the
embedding pipeline is added.

Relevant environment settings:

```sh
CLAUDE_PROMPT_CACHE_ENABLED=true
CLAUDE_WEB_SEARCH_ENABLED=true
CLAUDE_WEB_SEARCH_MAX_USES=3
LOCAL_RESPONSE_CACHE_ENABLED=true
LOCAL_RESPONSE_CACHE_TTL_SECONDS=300
```

Claude prompt caching is enabled with explicit cache breakpoints on stable provider
request prefixes. Local response caching stores exact-repeat prompt responses in
Postgres for a short TTL and bypasses Claude entirely on a hit.

Pricing is database-backed. Migrations seed a production pricing plan with
versioned module rates and cost components for API usage, hosting, operations,
and engineering. Module usage events snapshot the active rate at execution time;
invoices aggregate those events by user and module for the selected period.
See [docs/billing-architecture.md](docs/billing-architecture.md) for the billing
data model and BPMN/RAG module metering pattern.

## Docker

```sh
cp .env.example .env
make up
```

Compose starts Postgres with `pgvector`, Keycloak, the API, and an nginx-served
web build in detached mode. Data persists in named Docker volumes unless you run
`docker compose down -v`.

## RAG Pass 2 Foundation

The initial migration creates `rag_documents` and `rag_chunks` with a `vector(1536)`
embedding column. Pass 2 can add ingestion services, embedding providers, chunking,
retrieval, and prompt context assembly without changing the pass 1 boundaries.
