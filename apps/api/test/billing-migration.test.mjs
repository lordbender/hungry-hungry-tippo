import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(resolve(here, "../src/migrations/008_production_pricing_and_module_metering.sql"), "utf8");

test("production billing migration defines pricing and metering tables", () => {
  for (const table of [
    "billing_modules",
    "pricing_plans",
    "pricing_plan_versions",
    "pricing_cost_components",
    "pricing_rates",
    "organization_billing_profiles",
    "module_usage_events"
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${table}`), `${table} should be created`);
  }
});

test("production billing migration seeds core modules and operational cost components", () => {
  for (const moduleKey of [
    "prompt_workflow",
    "claude_completion",
    "web_search",
    "rag_context",
    "local_response_cache"
  ]) {
    assert.match(migration, new RegExp(`'${moduleKey}'`), `${moduleKey} should be seeded`);
  }

  for (const category of ["api_usage", "hosting", "operations", "engineering"]) {
    assert.match(migration, new RegExp(`'${category}'`), `${category} cost component should be seeded`);
  }
});

test("production billing migration includes BPMN/RAG metering hooks", () => {
  assert.match(migration, /bpmn_process_id/);
  assert.match(migration, /bpmn_activity_id/);
  assert.match(migration, /clientConfigurable/);
  assert.match(migration, /prompt-workflow/);
});
