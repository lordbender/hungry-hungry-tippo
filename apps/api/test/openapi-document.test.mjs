import assert from "node:assert/strict";
import test from "node:test";
import { createOpenApiDocument } from "../dist/openapi/document.js";

test("OpenAPI documents production invoice pricing fields", () => {
  const document = createOpenApiDocument("http://localhost:3001");
  const invoice = document.components.schemas.Invoice;
  const lineItem = document.components.schemas.InvoiceLineItem;

  assert.equal(document.openapi, "3.1.0");
  assert.ok(document.paths["/api/admin/invoices"]);
  assert.ok(document.paths["/api/admin/invoices/{invoiceId}/report.pdf"]);

  for (const field of [
    "pricingPlanName",
    "pricingPlanVersion",
    "currency",
    "subtotalCredits",
    "costCents",
    "amountCents",
    "reportGeneratedAt"
  ]) {
    assert.ok(invoice.required.includes(field), `Invoice should require ${field}`);
    assert.ok(invoice.properties[field], `Invoice should define ${field}`);
  }

  for (const field of ["moduleId", "moduleKey", "moduleName", "pricingRateId", "unitName", "creditCount"]) {
    assert.ok(lineItem.required.includes(field), `InvoiceLineItem should require ${field}`);
    assert.ok(lineItem.properties[field], `InvoiceLineItem should define ${field}`);
  }
});

test("OpenAPI invoice descriptions do not describe obsolete placeholder pricing", () => {
  const documentText = JSON.stringify(createOpenApiDocument("http://localhost:3001"));

  assert.match(documentText, /module usage events/i);
  assert.match(documentText, /pricing plan version/i);
  assert.doesNotMatch(documentText, /zero-rated placeholders/i);
});
