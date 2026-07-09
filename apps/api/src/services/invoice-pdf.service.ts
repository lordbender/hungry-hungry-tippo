import type { Invoice } from "@hhh/contracts";

const pageWidth = 612;
const pageHeight = 792;

export function generateInvoicePdf(invoice: Invoice): Buffer {
  const content = buildContent(invoice);
  const contentLength = Buffer.byteLength(content, "utf8");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`
  ];

  return writePdf(objects);
}

function buildContent(invoice: Invoice) {
  const lines: string[] = [
    "0.95 0.96 0.94 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`,
    "0 0 0 rg",
    text(50, 744, "F2", 22, "Invoice Report"),
    text(50, 720, "F1", 11, invoice.invoiceNumber),
    text(390, 744, "F2", 12, invoice.organizationName),
    text(390, 724, "F1", 10, `Created: ${formatDate(invoice.createdAt)}`),
    line(50, 700, 562, 700),
    text(50, 674, "F2", 11, "Billing Period"),
    text(50, 654, "F1", 10, `${formatDate(invoice.periodStart)} through ${formatDate(invoice.periodEnd)}`),
    text(290, 674, "F2", 11, "Summary"),
    text(290, 654, "F1", 10, `Requests: ${formatNumber(invoice.requestCount)}`),
    text(290, 638, "F1", 10, `Failed requests: ${formatNumber(invoice.failedRequestCount)}`),
    text(290, 622, "F1", 10, `Credits: ${formatNumber(invoice.subtotalCredits)}`),
    text(290, 606, "F1", 10, `Cost per credit: ${formatUsd(invoice.costPerCreditUsd)}`),
    text(290, 590, "F1", 10, `Billed per credit: ${formatUsd(invoice.pricePerCreditUsd)}`),
    text(290, 574, "F1", 10, `Amount: ${formatCurrency(invoice.amountCents)}`),
    line(50, 582, 562, 582),
    text(50, 550, "F2", 12, "User Credit Usage"),
    tableHeader(526)
  ];

  let y = 502;
  const lineItems = invoice.lineItems.length > 0 ? invoice.lineItems : [emptyLineItem()];

  for (const item of lineItems.slice(0, 10)) {
    lines.push(text(50, y, "F1", 9, truncate(item.description.replace(/^User usage: /, ""), 28)));
    lines.push(textRight(242, y, "F1", 9, formatNumber(item.requestCount)));
    lines.push(textRight(332, y, "F1", 9, formatNumber(item.creditCount)));
    lines.push(textRight(426, y, "F1", 9, formatUsd(item.pricePerCreditUsd)));
    lines.push(textRight(500, y, "F1", 9, formatCurrency(item.costCents)));
    lines.push(textRight(562, y, "F1", 9, formatCurrency(item.amountCents)));
    y -= 22;
  }

  lines.push(line(50, y + 8, 562, y + 8));
  lines.push(text(50, 86, "F1", 8, "This PDF is generated once and stored with the invoice for repeatable downloads."));
  lines.push(text(50, 70, "F1", 8, "Credits are calculated from input, cache creation, cache read, and output tokens."));
  lines.push(text(50, 54, "F1", 8, `Markup: ${formatPercent(invoice.markupRate)} over API cost per credit.`));

  return `${lines.join("\n")}\n`;
}

function tableHeader(y: number) {
  return [
    text(50, y, "F2", 9, "Description"),
    textRight(242, y, "F2", 9, "Requests"),
    textRight(332, y, "F2", 9, "Credits"),
    textRight(426, y, "F2", 9, "Rate"),
    textRight(500, y, "F2", 9, "Cost"),
    textRight(562, y, "F2", 9, "Amount"),
    line(50, y - 8, 562, y - 8)
  ].join("\n");
}

function emptyLineItem() {
  return {
    id: "",
    userId: null,
    description: "No invoiceable usage",
    requestCount: 0,
    inputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    creditCount: 0,
    costPerCreditUsd: 0,
    pricePerCreditUsd: 0,
    markupRate: 0,
    costCents: 0,
    amountCents: 0
  };
}

function text(x: number, y: number, font: "F1" | "F2", size: number, value: string) {
  return `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(value)}) Tj ET`;
}

function textRight(x: number, y: number, font: "F1" | "F2", size: number, value: string) {
  const width = value.length * size * 0.52;
  return text(Math.max(50, x - width), y, font, size, value);
}

function line(x1: number, y1: number, x2: number, y2: number) {
  return `0.75 w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function escapePdfText(value: string) {
  return value.replace(/[\\()]/g, (match) => `\\${match}`).replace(/[^\x20-\x7e]/g, "?");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}

function formatUsd(value: number) {
  return `$${value.toFixed(6)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function writePdf(objects: string[]) {
  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");

  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }

  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(chunks.join(""), "utf8");
}
