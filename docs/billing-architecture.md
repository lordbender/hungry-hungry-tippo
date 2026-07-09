# Billing, Pricing, and Module Metering

## Purpose

The billing system prices organizations from durable module usage events instead
of ad hoc token math in application code. Prompt, RAG, tool, and future BPMN
activities all write usage into the same metering table. Invoices then aggregate
those events for an organization and time period.

## Core Concepts

- Organization: the billable tenant.
- App user: the end user whose activity contributes to an organization's invoice.
- Session: a browser or client session tied to prompt activity.
- Billing module: a billable capability such as prompt orchestration, Claude
  completion, web search, RAG context, or local cache handling.
- Pricing plan: a named commercial plan, such as `production-standard`.
- Pricing plan version: immutable rate version used for invoice snapshots.
- Cost component: a cost basis item such as API usage, hosting, operations, or
  engineering allocation.
- Pricing rate: module/unit rate derived from cost basis and markup.
- Module usage event: the metering event emitted by workflow code.
- Invoice: an organization-period snapshot of usage and rates.
- Invoice report: a generated PDF stored in Postgres for repeatable downloads.

## Pricing Tables

`billing_modules` defines the billable capabilities. Seeded modules include:

- `prompt_workflow`
- `claude_completion`
- `web_search`
- `rag_context`
- `local_response_cache`

`pricing_plans` and `pricing_plan_versions` make pricing versioned. New rates
should be introduced by adding a new plan version rather than mutating historical
invoice rows.

`pricing_cost_components` captures the internal cost model. The seeded production
plan includes:

- API usage
- Hosting
- Operations
- Engineering

`pricing_rates` stores the actual module unit rates. The invoice engine reads
these through an organization's active billing profile.

`organization_billing_profiles` assigns a pricing plan version to each
organization. This is the hook for client-specific plans.

## Metering Flow

Workflow code records module usage through `ModuleUsageRepository.record`.

The current prompt workflow emits:

- `prompt_workflow` per prompt request
- `claude_completion` for token-derived credits
- `web_search` for web-search tool calls
- `rag_context` when RAG chunks are created from retrieved context
- `local_response_cache` for local cache hits

Each event snapshots:

- module
- pricing rate
- unit count
- token counts where applicable
- cost per unit
- price per unit
- markup
- cost cents
- amount cents
- optional BPMN process/activity identifiers

## BPMN/RAG Extension Pattern

Future BPMN or client-specific RAG modules should not add invoice-specific code.
They should:

1. Add or seed a `billing_modules` row.
2. Add a `pricing_rates` row for the relevant plan version.
3. Emit `module_usage_events` with:
   - `moduleKey`
   - `unitName`
   - `unitCount`
   - optional token counts
   - `bpmnProcessId`
   - `bpmnActivityId`
   - metadata for auditability

Invoices will pick those events up automatically for the organization and period.

## Invoice Flow

Invoice creation:

1. Resolves the organization's billing profile.
2. Snapshots pricing plan version, cost components, and rates into the invoice.
3. Aggregates module usage events by user, module, unit, and rate.
4. Stores invoice line items with cost and billed amount.
5. Leaves historical invoices stable if pricing later changes.

PDF report downloads:

1. Check `invoice_reports` for an existing PDF.
2. Generate and store a PDF only if one does not exist.
3. Return the stored PDF for every later download.

This makes invoice report downloads repeatable.

## Operational Notes

- Do not edit invoice line items after issuing an invoice; create a corrective
  invoice or future adjustment instead.
- Change pricing by creating a new plan version, then moving the organization's
  billing profile to that version.
- Use invoice `pricing_snapshot` and line-item `pricing_snapshot` to audit the
  commercial basis of historical invoices.
- Module usage is append-only in spirit. If a module emits bad usage, correct it
  with a compensating event rather than deleting history once invoices exist.
