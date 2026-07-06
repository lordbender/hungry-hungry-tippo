# Hungry Hungry Tippo

Starter full-stack agentic workflow example using:

- Node.js + Express API with service/controller/repository separation
- React + Material UI frontend
- Claude via the official Anthropic TypeScript SDK
- Postgres with `pgvector` ready for pass 2 RAG storage
- Prompt logging in Postgres
- First-pass agentic orchestration with optional Claude web search augmentation

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
make migrate
make dev
```

The web app runs at `http://localhost:5173` and the API at `http://localhost:3001`.

Set `ANTHROPIC_API_KEY` in `.env` before submitting prompts. The API creates a
`prompt_logs` row before every Claude call and updates it with response, latency,
token usage, or error details.

## Prompt Orchestration

The prompt endpoint accepts an `augmentationMode`:

- `auto`: default. The conductor enables web search when the prompt looks current,
  time-sensitive, documentation-specific, or internet-dependent.
- `web_search`: force Claude's server-side web search tool before the final answer.
- `direct`: bypass retrieval tools and answer directly.

When web search is applied, the API adds Claude's `web_search_20250305` server tool,
forces one search before the final answer, returns citations in the response, and
stores workflow metadata in `prompt_logs.metadata`.

Relevant environment settings:

```sh
CLAUDE_WEB_SEARCH_ENABLED=true
CLAUDE_WEB_SEARCH_MAX_USES=3
```

## Docker

```sh
cp .env.example .env
make up
```

Compose starts Postgres with `pgvector`, the API, and an nginx-served web build.

## RAG Pass 2 Foundation

The initial migration creates `rag_documents` and `rag_chunks` with a `vector(1536)`
embedding column. Pass 2 can add ingestion services, embedding providers, chunking,
retrieval, and prompt context assembly without changing the pass 1 boundaries.
