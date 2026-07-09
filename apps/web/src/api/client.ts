import {
  AdminOverviewResponseSchema,
  ApiErrorResponseSchema,
  CreateInvoiceRequestSchema,
  InvoiceListResponseSchema,
  InvoiceSchema,
  OrganizationListResponseSchema,
  OrganizationUsageResponseSchema,
  PromptResponseSchema,
  type AdminOverviewResponse,
  type CreateInvoiceRequest,
  type Invoice,
  type InvoiceListResponse,
  type OrganizationListResponse,
  type OrganizationUsageResponse,
  type PromptRequest,
  type PromptResponse
} from "@hhh/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function submitPrompt(request: PromptRequest, accessToken: string): Promise<PromptResponse> {
  const response = await fetch(`${apiBaseUrl}/api/prompts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error.message : "Prompt submission failed.");
  }

  return PromptResponseSchema.parse(payload);
}

export async function listOrganizations(accessToken: string): Promise<OrganizationListResponse> {
  return requestJson("/api/admin/organizations", accessToken, OrganizationListResponseSchema);
}

export async function getAdminOverview(input: {
  accessToken: string;
  from: string;
  to: string;
}): Promise<AdminOverviewResponse> {
  return requestJson(
    `/api/admin/reports/overview?from=${encodeURIComponent(input.from)}&to=${encodeURIComponent(input.to)}`,
    input.accessToken,
    AdminOverviewResponseSchema
  );
}

export async function getOrganizationUsage(input: {
  accessToken: string;
  organizationId: string;
  from: string;
  to: string;
}): Promise<OrganizationUsageResponse> {
  return requestJson(
    `/api/admin/reports/organizations/${input.organizationId}?from=${encodeURIComponent(input.from)}&to=${encodeURIComponent(input.to)}`,
    input.accessToken,
    OrganizationUsageResponseSchema
  );
}

export async function listInvoices(accessToken: string): Promise<InvoiceListResponse> {
  return requestJson("/api/admin/invoices", accessToken, InvoiceListResponseSchema);
}

export async function createInvoice(request: CreateInvoiceRequest, accessToken: string): Promise<Invoice> {
  const body = CreateInvoiceRequestSchema.parse(request);
  return requestJson("/api/admin/invoices", accessToken, InvoiceSchema, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

async function requestJson<T>(
  path: string,
  accessToken: string,
  schema: { parse: (payload: unknown) => T },
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error.message : "Request failed.");
  }

  return schema.parse(payload);
}
