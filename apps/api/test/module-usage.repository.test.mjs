import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repository = readFileSync(resolve(here, "../src/repositories/module-usage.repository.ts"), "utf8");

test("module usage SQL casts unit_count for integer columns and numeric cost math", () => {
  assert.match(
    repository,
    /\$10::integer/,
    "unit_count must be cast to integer so Postgres does not treat the parameter as numeric"
  );
  assert.match(
    repository,
    /round\(\(\$10::numeric\) \* selected_rate\.cost_per_unit_usd \* 100\)::int/,
    "cost math must cast unit_count to numeric to avoid integer/numeric parameter conflicts"
  );
  assert.match(
    repository,
    /round\(\(\$10::numeric\) \* selected_rate\.price_per_unit_usd \* 100\)::int/,
    "price math must cast unit_count to numeric to avoid integer/numeric parameter conflicts"
  );
  assert.doesNotMatch(
    repository,
    /round\(\$10 \* selected_rate\.(cost|price)_per_unit_usd \* 100\)::int/,
    "untyped \$10 multiplication against numeric rates must not remain"
  );
});
