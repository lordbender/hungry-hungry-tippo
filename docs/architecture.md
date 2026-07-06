# Evolving Architecture

## Purpose

Hungry Hungry Tippo is a starter full-stack agentic workflow application. The first pass provides a prompt UI, an Express API, Claude integration, prompt logging, and an initial orchestration layer that can augment prompts with Claude web search before asking the model to answer.

The architecture should stay intentionally modular because the system is expected to grow from a prototype into a production workflow platform.

## Current System Shape

```text
apps/web
  React + Material UI prompt interface

apps/api
  Express API
  Controllers
  Services
  Repositories
  Database migrations
  Claude integration

packages/contracts
  Shared Zod schemas
  Shared TypeScript request/response contracts

postgres
  Prompt logs
  Future RAG documents and chunks
  pgvector extension
```

## Request Flow

1. The user enters a prompt in the React app.
2. The frontend sends `POST /api/prompts` with:
   - `prompt`
   - `augmentationMode`: `auto`, `direct`, or `web_search`
3. The controller validates the request using shared contract schemas.
4. `PromptWorkflowService` creates a pending prompt log.
5. `PromptConductorService` plans how the prompt should be handled.
6. `ClaudeService` calls Claude directly or with web search enabled.
7. Web-search citations are persisted into the RAG tables as source documents and chunks.
8. The prompt log is updated with the response, latency, token usage, and workflow metadata.
9. The frontend displays the model response, workflow mode, search count, and citations.

## API Layering

The API is split by responsibility:

- Controllers handle HTTP concerns and request validation.
- Services coordinate business behavior and workflow decisions.
- Repositories own database access.
- Models define persistence-facing TypeScript types.
- Contracts define API-facing schemas shared with the frontend.

This keeps the controller thin and gives future RAG, tool calling, evaluation, and audit features clear places to attach.

## Agentic Workflow Layer

The current workflow is intentionally small:

- `direct`: send the prompt directly to Claude.
- `auto`: decide whether the prompt needs live/current context.
- `web_search`: force Claude to use the server-side web search tool.

The conductor is the first durable agentic boundary. Over time it can evolve from simple heuristics into a richer planner that chooses among RAG retrieval, web search, internal tools, user context, and multi-step task execution.

## Data Storage

Postgres is the system of record.

Current tables:

- `prompt_logs`: prompt, response, model, status, latency, token usage, errors, and metadata.
- `rag_documents`: placeholder table for future source documents.
- `rag_chunks`: placeholder table for future chunked text and embeddings.

`pgvector` is enabled so pass 2 can add embedding search without changing the database platform.

## Prompt Logging

Prompt logging is part of pass 1, not an afterthought. Logs should support:

- Debugging model responses.
- Auditing orchestration decisions.
- Measuring latency and token usage.
- Tracking failed requests.
- Future evaluation and regression testing.

The `metadata` JSONB column is the extension point for workflow-specific details such as applied augmentation mode, search counts, citations, selected retrievers, and future tool traces.

`prompt_logs.augmented_prompt` stores the full prompt envelope used by the workflow:

- workflow plan
- retrieval tool configuration
- system prompt
- original user prompt

For Claude server-side web search, the actual search result injection happens inside
the Claude API call. The application therefore logs the exact prompt envelope sent to
Claude and separately persists returned citations as RAG seed data.

## RAG Seed Data From Web Search

When web search is applied and Claude returns citations:

- each cited URL is upserted into `rag_documents`
- each cited snippet is appended to `rag_chunks`
- chunk metadata links back to the originating `promptLogId`
- embeddings remain `null` until the embedding pipeline is implemented

This gives the project a durable retrieval corpus from externally sourced answers
without pretending that citation snippets are already fully embedded RAG knowledge.

## Configuration

Important environment settings:

```sh
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-opus-4-8
CLAUDE_MAX_TOKENS=1024
CLAUDE_WEB_SEARCH_ENABLED=true
CLAUDE_WEB_SEARCH_MAX_USES=3
DATABASE_URL=postgres://tippo:tippo@localhost:5432/tippo
```

The API explicitly loads the root `.env` during local development. Docker Compose passes the same variables into the API container.

## Near-Term Evolution

### Pass 2: RAG Ingestion

Add a document ingestion path:

1. Upload or register documents.
2. Extract text.
3. Chunk documents.
4. Generate embeddings.
5. Store chunks and embeddings in `rag_chunks`.
6. Add repository and service layers for retrieval.

### Pass 3: Retrieval Planning

Extend the conductor to choose among:

- Direct answer.
- Web search.
- Internal RAG.
- Web search plus RAG.
- Tool execution.

The conductor should return a structured plan, not just a mode string.

### Pass 4: Evaluations

Add repeatable evaluation runs using saved prompts and expected behavior:

- Did the conductor choose the right retrieval strategy?
- Did the answer cite sources when retrieval was used?
- Did latency and token usage stay within bounds?
- Did the response avoid claiming missing capabilities when tools were available?

### Pass 5: Production Hardening

Before production, add:

- Authentication and authorization.
- Rate limiting.
- Request IDs and structured logging.
- Secret management outside `.env`.
- Database migration tooling with rollback strategy.
- Observability dashboards.
- Background jobs for ingestion.
- Cost controls for web search and model usage.
- Data retention policy for prompts and responses.

## Architectural Principles

- Keep HTTP, workflow, model provider, and persistence concerns separate.
- Store enough metadata to explain every model answer after the fact.
- Prefer provider abstractions where the business workflow should not care about SDK details.
- Treat retrieval as a planned step, not as string concatenation.
- Make the first version simple, but leave obvious extension points.
- Keep shared request and response contracts executable through Zod schemas.

## Open Questions

- Which embedding provider should be used for RAG?
- Should documents be scoped by user, tenant, workspace, or project?
- What prompt and response data should be retained in production?
- Should web search be allowed by default or require explicit user selection?
- How should the system rank RAG context against web context when both are available?
- Do we need streaming responses before adding deeper workflows?
