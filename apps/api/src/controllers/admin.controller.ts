import type { Request, Response } from "express";
import { AdminDateRangeQuerySchema, CreateInvoiceRequestSchema } from "@hhh/contracts";
import { AppError } from "../errors/app-error.js";
import { billingContextRepository } from "../repositories/billing-context.repository.js";
import { reportingRepository } from "../repositories/reporting.repository.js";
import { generateInvoicePdf } from "../services/invoice-pdf.service.js";

function parseDateRange(query: Request["query"]) {
  const parsed = AdminDateRangeQuerySchema.parse({
    from: query.from,
    to: query.to
  });
  const from = new Date(parsed.from);
  const to = new Date(parsed.to);

  if (to <= from) {
    throw new AppError("INVALID_DATE_RANGE", "The end date must be after the start date.", 400);
  }

  return { from, to };
}

export async function listOrganizations(_req: Request, res: Response) {
  res.json({ organizations: await reportingRepository.listOrganizations() });
}

export async function getOverview(req: Request, res: Response) {
  const range = parseDateRange(req.query);
  res.json(await reportingRepository.overview(range));
}

export async function getOrganizationUsage(req: Request, res: Response) {
  const range = parseDateRange(req.query);
  const { organizationId } = req.params;

  if (!organizationId) {
    throw new AppError("ORGANIZATION_ID_REQUIRED", "Organization ID is required.", 400);
  }

  const usage = await reportingRepository.organizationUsage({
    organizationId,
    ...range
  });

  if (!usage) {
    throw new AppError("ORGANIZATION_NOT_FOUND", "Organization was not found.", 404);
  }

  res.json(usage);
}

export async function listInvoices(_req: Request, res: Response) {
  res.json({ invoices: await reportingRepository.listInvoices() });
}

export async function createInvoice(req: Request, res: Response) {
  const input = CreateInvoiceRequestSchema.parse(req.body);
  const createdBy = req.auth
    ? await billingContextRepository.resolve({
        actor: req.auth,
        clientSessionId: "admin-reporting"
      })
    : null;

  const invoice = await reportingRepository.createInvoice({
    organizationId: input.organizationId,
    periodStart: new Date(input.periodStart),
    periodEnd: new Date(input.periodEnd),
    createdByUserId: createdBy?.user.id
  });

  res.status(201).json(invoice);
}

export async function downloadInvoiceReport(req: Request, res: Response) {
  const { invoiceId } = req.params;

  if (!invoiceId) {
    throw new AppError("INVOICE_ID_REQUIRED", "Invoice ID is required.", 400);
  }

  const storedReport = await reportingRepository.getInvoiceReport(invoiceId);
  const report = storedReport ?? (await createAndStoreInvoiceReport(invoiceId));

  res.setHeader("Content-Type", report.contentType);
  res.setHeader("Content-Length", report.content.byteLength);
  res.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.send(report.content);
}

async function createAndStoreInvoiceReport(invoiceId: string) {
  const invoice = await reportingRepository.getInvoice(invoiceId);

  if (!invoice) {
    throw new AppError("INVOICE_NOT_FOUND", "Invoice was not found.", 404);
  }

  const content = generateInvoicePdf(invoice);
  return reportingRepository.storeInvoiceReport({
    invoiceId,
    filename: `${safeFilename(invoice.invoiceNumber)}.pdf`,
    contentType: "application/pdf",
    content
  });
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
