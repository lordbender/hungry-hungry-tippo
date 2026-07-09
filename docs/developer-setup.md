# Developer Setup

## Local Dependencies

Install these before running the project locally:

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop
- GNU Make or the platform `make` command
- Git
- curl, useful for API smoke tests

Optional but helpful:

- `psql`, for command-line Postgres access
- VS Code or another TypeScript-friendly editor
- A browser for the React app and PGAdmin

## First-Time Setup

From the repository root:

```sh
cp .env.example .env
npm install
make up
```

The default local URLs are:

- Web app: `http://localhost:5173`
- API: `http://localhost:3001`
- API health: `http://localhost:3001/health`
- Swagger/OpenAPI: `http://localhost:3001/api/docs`
- PGAdmin: `http://localhost:5050`
- Keycloak: `http://localhost:8081`

Set `ANTHROPIC_API_KEY` in `.env` before submitting prompts to Claude.

Caching-related defaults in `.env`:

```sh
CLAUDE_PROMPT_CACHE_ENABLED=true
LOCAL_RESPONSE_CACHE_ENABLED=true
LOCAL_RESPONSE_CACHE_TTL_SECONDS=300
```

Claude prompt caching uses Anthropic cache breakpoints on stable prompt prefixes.
Local response caching stores exact-repeat responses in Postgres for the configured
TTL and bypasses Claude on a cache hit.

## Local Database Credentials

The local database is a single Postgres instance with the `pgvector` extension enabled.
Relational tables and vector/RAG tables live in the same database.

Default connection values:

```text
Host from your machine: localhost
Host from Docker/PGAdmin: postgres
Port: 5432
Database: tippo
Username: tippo
Password: tippo
Connection string: postgres://tippo:tippo@localhost:5432/tippo
```

Relational data currently includes tables such as:

- `prompt_logs`
- `organizations`
- `app_users`
- `prompt_sessions`
- `billing_modules`
- `pricing_plans`
- `pricing_plan_versions`
- `pricing_cost_components`
- `pricing_rates`
- `organization_billing_profiles`
- `module_usage_events`
- `invoices`
- `invoice_line_items`
- `invoice_reports`
- `schema_migrations`

Vector/RAG data currently includes:

- `rag_documents`
- `rag_chunks`

`rag_chunks.embedding` is a `vector(1536)` column. Web-search citation snippets are
stored there with `embedding = null` until the embedding pipeline is implemented.

## PGAdmin Setup

Start Postgres and PGAdmin:

```sh
make pgadmin-up
```

Open:

```text
http://localhost:5050
```

Login:

```text
Email: admin@hungry-hungry-tippo.local
Password: tippo-admin
```

These values come from `.env`:

```sh
PGADMIN_DEFAULT_EMAIL=admin@hungry-hungry-tippo.local
PGADMIN_DEFAULT_PASSWORD=tippo-admin
PGADMIN_PORT=5050
```

For a real shared environment, change the PGAdmin password before exposing the service.

## Register the Relational Database in PGAdmin

Use the host value that matches where PGAdmin is running:

```text
PGAdmin from this Docker Compose stack: postgres
PGAdmin installed directly on your Mac/host: localhost
PGAdmin in a separate Docker container: host.docker.internal
```

In PGAdmin:

1. Right-click `Servers`.
2. Select `Register` > `Server`.
3. On the `General` tab, set `Name` to `Tippo Relational`.
4. On the `Connection` tab, use the matching host value:

```text
Host name/address: postgres
Port: 5432
Maintenance database: tippo
Username: tippo
Password: tippo
Save password: enabled
```

If you see `failed to resolve host 'postgres'`, your PGAdmin instance is not running
inside this Compose network. Change `Host name/address` to `localhost` for native
PGAdmin, or `host.docker.internal` for a separate Dockerized PGAdmin.

After saving, browse:

```text
Servers
  Tippo Relational
    Databases
      tippo
        Schemas
          public
            Tables
```

Use this server entry for normal relational data inspection, especially `prompt_logs`.

## Register the Vector/RAG Database in PGAdmin

The vector database is the same Postgres database with `pgvector` enabled. Registering
a second PGAdmin server entry is optional, but it makes the RAG side easier to see
while developing.

Create another server with:

```text
Name: Tippo Vector RAG
Host name/address: postgres
Port: 5432
Maintenance database: tippo
Username: tippo
Password: tippo
Save password: enabled
```

Use the same host-name rule as above. `postgres` is correct only for PGAdmin started
with `make pgadmin-up`.

Use this entry when inspecting:

- `rag_documents`
- `rag_chunks`
- `rag_chunks.embedding`

To confirm `pgvector` is installed, open PGAdmin's query tool and run:

```sql
select extname, extversion
from pg_extension
where extname = 'vector';
```

To inspect recent RAG seed chunks:

```sql
select
  c.created_at,
  d.title,
  d.source_uri,
  c.content,
  c.embedding is not null as has_embedding,
  c.metadata
from rag_chunks c
join rag_documents d on d.id = c.document_id
order by c.created_at desc
limit 25;
```

## Useful Commands

```sh
make install       # install npm workspace dependencies
make db-up         # start only Postgres
make pgadmin-up    # start Postgres and PGAdmin
make keycloak-up   # start local Keycloak and its database
make migrate       # apply database migrations
make dev           # run API and web app in dev mode
make up            # build and run the persistent Docker stack detached
make typecheck     # run TypeScript checks
make build         # production build
make test          # run typecheck and focused Node tests
make logs          # follow all Docker Compose logs
make down          # stop Compose services
```

`make up` runs Docker Compose in detached mode. Stopping log output with Ctrl-C
does not stop containers. Data persists in named Docker volumes unless you run
`docker compose down -v`.

## Billing and Pricing Inspection

Pricing is seeded by migrations, not environment variables. Inspect these tables
when debugging invoice math:

```sql
select plan_key, name, status
from pricing_plans;

select bm.module_key, pr.unit_name, pr.cost_per_unit_usd, pr.markup_rate, pr.price_per_unit_usd
from pricing_rates pr
join billing_modules bm on bm.id = pr.module_id
join pricing_plan_versions ppv on ppv.id = pr.plan_version_id
join pricing_plans pp on pp.id = ppv.plan_id
where pp.plan_key = 'production-standard'
order by bm.module_key, pr.unit_name;

select bm.module_key, mue.unit_name, sum(mue.unit_count) as units, sum(mue.amount_cents) as amount_cents
from module_usage_events mue
join billing_modules bm on bm.id = mue.module_id
group by bm.module_key, mue.unit_name
order by bm.module_key, mue.unit_name;
```

Invoices aggregate `module_usage_events` by user, module, unit, and rate. PDF
reports are stored in `invoice_reports` on first download so later downloads return
the same bytes.

## Smoke Tests

API health:

```sh
curl -sS http://localhost:3001/health
```

Prompt endpoint:

```sh
curl -sS -X POST http://localhost:3001/api/prompts \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"How do I enable real-time access?","augmentationMode":"auto"}'
```

## Troubleshooting

If PGAdmin cannot connect to Postgres, make sure you used `postgres` as the host
when PGAdmin was started by this project's Docker Compose stack.

If you connect from a local desktop database client instead of PGAdmin, use
`localhost` as the host.

If you are using a separate PGAdmin Docker container, use `host.docker.internal` as
the host, or attach that container to this Compose project's Docker network.

If migrations fail with a `tsx` IPC permission error inside the managed sandbox, rerun:

```sh
make migrate
```

from your terminal, or allow the escalated run when prompted.
