import assert from "node:assert/strict";
import test from "node:test";
import { generateInvoicePdf } from "../dist/services/invoice-pdf.service.js";

function sampleInvoice() {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    invoiceNumber: "INV-TEST",
    organizationId: "00000000-0000-0000-0000-000000000001",
    organizationName: "Acme Workflow Co",
    pricingPlanName: "Production Standard",
    pricingPlanVersion: 1,
    currency: "USD",
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-08-01T00:00:00.000Z",
    status: "draft",
    requestCount: 4,
    failedRequestCount: 0,
    subtotalTokens: 1200,
    subtotalCredits: 1202,
    costPerCreditUsd: 0,
    pricePerCreditUsd: 0,
    markupRate: 0,
    costCents: 10,
    amountCents: 15,
    createdAt: "2026-07-09T12:00:00.000Z",
    reportGeneratedAt: null,
    lineItems: [
      {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "00000000-0000-0000-0000-000000000003",
        moduleId: "00000000-0000-0000-0000-000000000004",
        moduleKey: "claude_completion",
        moduleName: "Claude Completion",
        pricingRateId: "00000000-0000-0000-0000-000000000005",
        unitName: "credit",
        description: "admin - Claude Completion (credit)",
        requestCount: 3,
        inputTokens: 900,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
        outputTokens: 150,
        totalTokens: 1200,
        creditCount: 1200,
        costPerCreditUsd: 0.00000175,
        pricePerCreditUsd: 0.00000263,
        markupRate: 0.5,
        costCents: 10,
        amountCents: 15
      },
      {
        id: "00000000-0000-0000-0000-000000000006",
        userId: "00000000-0000-0000-0000-000000000003",
        moduleId: "00000000-0000-0000-0000-000000000007",
        moduleKey: "web_search",
        moduleName: "Web Search Tool",
        pricingRateId: "00000000-0000-0000-0000-000000000008",
        unitName: "request",
        description: "admin - Web Search Tool (request)",
        requestCount: 1,
        inputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        creditCount: 2,
        costPerCreditUsd: 0.001,
        pricePerCreditUsd: 0.0015,
        markupRate: 0.5,
        costCents: 0,
        amountCents: 0
      }
    ]
  };
}

test("generateInvoicePdf emits a stable one-page PDF with pricing context", () => {
  const pdf = generateInvoicePdf(sampleInvoice());
  const text = pdf.toString("latin1");

  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(text, /Invoice Report/);
  assert.match(text, /INV-TEST/);
  assert.match(text, /Production Standard v1/);
  assert.match(text, /User Credit Usage/);
  assert.match(text, /Claude Completion/);
  assert.match(text, /%%EOF/);
});
