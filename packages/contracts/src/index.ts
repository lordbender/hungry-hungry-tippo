import { z } from "zod";

export const AugmentationModeSchema = z.enum(["auto", "direct", "web_search"]);

export const CitationSchema = z.object({
  title: z.string().nullable(),
  url: z.string().url(),
  citedText: z.string().nullable()
});

export const PromptRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(12000, "Prompt is too long"),
  augmentationMode: AugmentationModeSchema.default("auto"),
  sessionId: z.string().trim().min(1).max(128).optional()
});

export const PromptResponseSchema = z.object({
  promptLogId: z.string().uuid(),
  model: z.string(),
  response: z.string(),
  workflow: z.object({
    requestedMode: AugmentationModeSchema,
    appliedMode: z.enum(["direct", "web_search"]),
    webSearchRequests: z.number().int().nonnegative(),
    localCacheHit: z.boolean(),
    citations: z.array(CitationSchema),
    rationale: z.string()
  }),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().nullable(),
    cacheCreationInputTokens: z.number().int().nonnegative().nullable(),
    cacheReadInputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable()
  })
});

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export const AdminDateRangeQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  billingEmail: z.string().nullable(),
  createdAt: z.string().datetime()
});

export const OrganizationListResponseSchema = z.object({
  organizations: z.array(OrganizationSchema)
});

export const UsageSummarySchema = z.object({
  requestCount: z.number().int().nonnegative(),
  succeededRequestCount: z.number().int().nonnegative(),
  failedRequestCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  cacheCreationInputTokens: z.number().int().nonnegative(),
  cacheReadInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative()
});

export const OrganizationUsageSummarySchema = UsageSummarySchema.extend({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  billingEmail: z.string().nullable()
});

export const UserUsageSummarySchema = UsageSummarySchema.extend({
  userId: z.string().uuid(),
  username: z.string(),
  email: z.string().nullable()
});

export const SessionUsageSummarySchema = UsageSummarySchema.extend({
  sessionId: z.string().uuid(),
  clientSessionId: z.string(),
  username: z.string(),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime()
});

export const PromptUsageRecordSchema = z.object({
  promptLogId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  username: z.string().nullable(),
  sessionId: z.string().uuid().nullable(),
  clientSessionId: z.string().nullable(),
  promptPreview: z.string(),
  model: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]),
  inputTokens: z.number().int().nonnegative(),
  cacheCreationInputTokens: z.number().int().nonnegative(),
  cacheReadInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  createdAt: z.string().datetime()
});

export const AdminOverviewResponseSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  organizations: z.array(OrganizationUsageSummarySchema),
  totals: UsageSummarySchema
});

export const OrganizationUsageResponseSchema = z.object({
  organization: OrganizationSchema,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totals: UsageSummarySchema,
  users: z.array(UserUsageSummarySchema),
  sessions: z.array(SessionUsageSummarySchema),
  prompts: z.array(PromptUsageRecordSchema)
});

export const InvoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  description: z.string(),
  requestCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  cacheCreationInputTokens: z.number().int().nonnegative(),
  cacheReadInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  creditCount: z.number().int().nonnegative(),
  costPerCreditUsd: z.number().nonnegative(),
  pricePerCreditUsd: z.number().nonnegative(),
  markupRate: z.number().nonnegative(),
  costCents: z.number().int().nonnegative(),
  amountCents: z.number().int().nonnegative()
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  status: z.enum(["draft", "finalized", "void"]),
  requestCount: z.number().int().nonnegative(),
  failedRequestCount: z.number().int().nonnegative(),
  subtotalTokens: z.number().int().nonnegative(),
  subtotalCredits: z.number().int().nonnegative(),
  costPerCreditUsd: z.number().nonnegative(),
  pricePerCreditUsd: z.number().nonnegative(),
  markupRate: z.number().nonnegative(),
  costCents: z.number().int().nonnegative(),
  amountCents: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  reportGeneratedAt: z.string().datetime().nullable(),
  lineItems: z.array(InvoiceLineItemSchema)
});

export const InvoiceListResponseSchema = z.object({
  invoices: z.array(InvoiceSchema)
});

export const CreateInvoiceRequestSchema = z.object({
  organizationId: z.string().uuid(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime()
});

export type AugmentationMode = z.infer<typeof AugmentationModeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type PromptRequest = z.infer<typeof PromptRequestSchema>;
export type PromptResponse = z.infer<typeof PromptResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type OrganizationListResponse = z.infer<typeof OrganizationListResponseSchema>;
export type UsageSummary = z.infer<typeof UsageSummarySchema>;
export type OrganizationUsageSummary = z.infer<typeof OrganizationUsageSummarySchema>;
export type UserUsageSummary = z.infer<typeof UserUsageSummarySchema>;
export type SessionUsageSummary = z.infer<typeof SessionUsageSummarySchema>;
export type PromptUsageRecord = z.infer<typeof PromptUsageRecordSchema>;
export type AdminOverviewResponse = z.infer<typeof AdminOverviewResponseSchema>;
export type OrganizationUsageResponse = z.infer<typeof OrganizationUsageResponseSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceListResponse = z.infer<typeof InvoiceListResponseSchema>;
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceRequestSchema>;
