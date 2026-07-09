import { randomUUID } from "node:crypto";
import type {
  AdminOverviewResponse,
  Invoice,
  Organization,
  OrganizationUsageResponse,
  UsageSummary
} from "@hhh/contracts";
import { pool } from "../database/pool.js";

type UsageSummaryRow = {
  request_count: number;
  succeeded_request_count: number;
  failed_request_count: number;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  created_at: Date;
};

type OrganizationUsageRow = UsageSummaryRow & {
  organization_id: string;
  organization_name: string;
  billing_email: string | null;
};

type UserUsageRow = UsageSummaryRow & {
  user_id: string;
  username: string;
  email: string | null;
};

type SessionUsageRow = UsageSummaryRow & {
  session_id: string;
  client_session_id: string;
  username: string;
  started_at: Date;
  last_seen_at: Date;
};

type PromptUsageRow = {
  prompt_log_id: string;
  user_id: string | null;
  username: string | null;
  session_id: string | null;
  client_session_id: string | null;
  prompt_preview: string;
  model: string;
  status: "pending" | "succeeded" | "failed";
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: Date;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  organization_id: string;
  organization_name: string;
  period_start: Date;
  period_end: Date;
  status: "draft" | "finalized" | "void";
  request_count: number;
  failed_request_count: number;
  subtotal_tokens: number;
  amount_cents: number;
  created_at: Date;
};

type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  request_count: number;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  amount_cents: number;
};

function summarySelect(alias = "pl") {
  return `
    count(*)::int as request_count,
    count(*) filter (where ${alias}.status = 'succeeded')::int as succeeded_request_count,
    count(*) filter (where ${alias}.status = 'failed')::int as failed_request_count,
    coalesce(sum(coalesce(${alias}.input_tokens, 0)), 0)::int as input_tokens,
    coalesce(sum(coalesce(${alias}.cache_creation_input_tokens, 0)), 0)::int as cache_creation_input_tokens,
    coalesce(sum(coalesce(${alias}.cache_read_input_tokens, 0)), 0)::int as cache_read_input_tokens,
    coalesce(sum(coalesce(${alias}.output_tokens, 0)), 0)::int as output_tokens,
    coalesce(sum(
      coalesce(${alias}.input_tokens, 0) +
      coalesce(${alias}.cache_creation_input_tokens, 0) +
      coalesce(${alias}.cache_read_input_tokens, 0) +
      coalesce(${alias}.output_tokens, 0)
    ), 0)::int as total_tokens
  `;
}

function toIso(value: Date) {
  return value.toISOString();
}

function toSummary(row: UsageSummaryRow): UsageSummary {
  return {
    requestCount: row.request_count,
    succeededRequestCount: row.succeeded_request_count,
    failedRequestCount: row.failed_request_count,
    inputTokens: row.input_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens
  };
}

function emptySummary(): UsageSummary {
  return {
    requestCount: 0,
    succeededRequestCount: 0,
    failedRequestCount: 0,
    inputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    billingEmail: row.billing_email,
    createdAt: toIso(row.created_at)
  };
}

function toInvoice(row: InvoiceRow, lineItems: InvoiceLineItemRow[]): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    periodStart: toIso(row.period_start),
    periodEnd: toIso(row.period_end),
    status: row.status,
    requestCount: row.request_count,
    failedRequestCount: row.failed_request_count,
    subtotalTokens: row.subtotal_tokens,
    amountCents: row.amount_cents,
    createdAt: toIso(row.created_at),
    lineItems: lineItems
      .filter((line) => line.invoice_id === row.id)
      .map((line) => ({
        id: line.id,
        description: line.description,
        requestCount: line.request_count,
        inputTokens: line.input_tokens,
        cacheCreationInputTokens: line.cache_creation_input_tokens,
        cacheReadInputTokens: line.cache_read_input_tokens,
        outputTokens: line.output_tokens,
        totalTokens: line.total_tokens,
        amountCents: line.amount_cents
      }))
  };
}

export class ReportingRepository {
  async listOrganizations(): Promise<Organization[]> {
    const { rows } = await pool.query<OrganizationRow>(
      `
        select id, name, slug, billing_email, created_at
        from organizations
        order by name asc
      `
    );

    return rows.map(toOrganization);
  }

  async overview(input: { from: Date; to: Date }): Promise<AdminOverviewResponse> {
    const [organizationUsage, totals] = await Promise.all([
      pool.query<OrganizationUsageRow>(
        `
          select
            org.id as organization_id,
            org.name as organization_name,
            org.billing_email,
            ${summarySelect("pl")}
          from prompt_logs pl
          join organizations org on org.id = pl.organization_id
          where pl.created_at >= $1 and pl.created_at < $2
          group by org.id, org.name, org.billing_email
          order by total_tokens desc, request_count desc, org.name asc
        `,
        [input.from, input.to]
      ),
      pool.query<UsageSummaryRow>(
        `
          select ${summarySelect("pl")}
          from prompt_logs pl
          where pl.created_at >= $1 and pl.created_at < $2
        `,
        [input.from, input.to]
      )
    ]);

    return {
      periodStart: toIso(input.from),
      periodEnd: toIso(input.to),
      organizations: organizationUsage.rows.map((row) => ({
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        billingEmail: row.billing_email,
        ...toSummary(row)
      })),
      totals: totals.rows[0] ? toSummary(totals.rows[0]) : emptySummary()
    };
  }

  async organizationUsage(input: {
    organizationId: string;
    from: Date;
    to: Date;
  }): Promise<OrganizationUsageResponse | null> {
    const organization = await pool.query<OrganizationRow>(
      `
        select id, name, slug, billing_email, created_at
        from organizations
        where id = $1
      `,
      [input.organizationId]
    );

    if (!organization.rows[0]) {
      return null;
    }

    const [totals, users, sessions, prompts] = await Promise.all([
      pool.query<UsageSummaryRow>(
        `
          select ${summarySelect("pl")}
          from prompt_logs pl
          where pl.organization_id = $1 and pl.created_at >= $2 and pl.created_at < $3
        `,
        [input.organizationId, input.from, input.to]
      ),
      pool.query<UserUsageRow>(
        `
          select
            users.id as user_id,
            users.username,
            users.email,
            ${summarySelect("pl")}
          from prompt_logs pl
          join app_users users on users.id = pl.user_id
          where pl.organization_id = $1 and pl.created_at >= $2 and pl.created_at < $3
          group by users.id, users.username, users.email
          order by total_tokens desc, request_count desc, users.username asc
        `,
        [input.organizationId, input.from, input.to]
      ),
      pool.query<SessionUsageRow>(
        `
          select
            sessions.id as session_id,
            sessions.client_session_id,
            users.username,
            sessions.started_at,
            sessions.last_seen_at,
            ${summarySelect("pl")}
          from prompt_logs pl
          join prompt_sessions sessions on sessions.id = pl.session_id
          join app_users users on users.id = sessions.user_id
          where pl.organization_id = $1 and pl.created_at >= $2 and pl.created_at < $3
          group by sessions.id, sessions.client_session_id, users.username, sessions.started_at, sessions.last_seen_at
          order by sessions.last_seen_at desc
        `,
        [input.organizationId, input.from, input.to]
      ),
      pool.query<PromptUsageRow>(
        `
          select
            pl.id as prompt_log_id,
            users.id as user_id,
            users.username,
            sessions.id as session_id,
            sessions.client_session_id,
            left(pl.prompt, 140) as prompt_preview,
            pl.model,
            pl.status,
            coalesce(pl.input_tokens, 0)::int as input_tokens,
            coalesce(pl.cache_creation_input_tokens, 0)::int as cache_creation_input_tokens,
            coalesce(pl.cache_read_input_tokens, 0)::int as cache_read_input_tokens,
            coalesce(pl.output_tokens, 0)::int as output_tokens,
            (
              coalesce(pl.input_tokens, 0) +
              coalesce(pl.cache_creation_input_tokens, 0) +
              coalesce(pl.cache_read_input_tokens, 0) +
              coalesce(pl.output_tokens, 0)
            )::int as total_tokens,
            pl.created_at
          from prompt_logs pl
          left join app_users users on users.id = pl.user_id
          left join prompt_sessions sessions on sessions.id = pl.session_id
          where pl.organization_id = $1 and pl.created_at >= $2 and pl.created_at < $3
          order by pl.created_at desc
          limit 250
        `,
        [input.organizationId, input.from, input.to]
      )
    ]);

    return {
      organization: toOrganization(organization.rows[0]),
      periodStart: toIso(input.from),
      periodEnd: toIso(input.to),
      totals: totals.rows[0] ? toSummary(totals.rows[0]) : emptySummary(),
      users: users.rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        email: row.email,
        ...toSummary(row)
      })),
      sessions: sessions.rows.map((row) => ({
        sessionId: row.session_id,
        clientSessionId: row.client_session_id,
        username: row.username,
        startedAt: toIso(row.started_at),
        lastSeenAt: toIso(row.last_seen_at),
        ...toSummary(row)
      })),
      prompts: prompts.rows.map((row) => ({
        promptLogId: row.prompt_log_id,
        userId: row.user_id,
        username: row.username,
        sessionId: row.session_id,
        clientSessionId: row.client_session_id,
        promptPreview: row.prompt_preview,
        model: row.model,
        status: row.status,
        inputTokens: row.input_tokens,
        cacheCreationInputTokens: row.cache_creation_input_tokens,
        cacheReadInputTokens: row.cache_read_input_tokens,
        outputTokens: row.output_tokens,
        totalTokens: row.total_tokens,
        createdAt: toIso(row.created_at)
      }))
    };
  }

  async createInvoice(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    createdByUserId?: string;
  }): Promise<Invoice> {
    const invoiceNumber = this.createInvoiceNumber();
    const client = await pool.connect();

    try {
      await client.query("begin");

      const totals = await client.query<UsageSummaryRow>(
        `
          select ${summarySelect("pl")}
          from prompt_logs pl
          where pl.organization_id = $1 and pl.created_at >= $2 and pl.created_at < $3
        `,
        [input.organizationId, input.periodStart, input.periodEnd]
      );
      const summary = totals.rows[0] ? toSummary(totals.rows[0]) : emptySummary();

      const invoice = await client.query<InvoiceRow>(
        `
          insert into invoices (
            invoice_number,
            organization_id,
            period_start,
            period_end,
            request_count,
            failed_request_count,
            subtotal_tokens,
            amount_cents,
            created_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, 0, $8)
          returning
            id,
            invoice_number,
            organization_id,
            (select name from organizations where id = invoices.organization_id) as organization_name,
            period_start,
            period_end,
            status,
            request_count,
            failed_request_count,
            subtotal_tokens,
            amount_cents,
            created_at
        `,
        [
          invoiceNumber,
          input.organizationId,
          input.periodStart,
          input.periodEnd,
          summary.requestCount,
          summary.failedRequestCount,
          summary.totalTokens,
          input.createdByUserId ?? null
        ]
      );

      const invoiceRow = invoice.rows[0];
      if (!invoiceRow) {
        throw new Error("Invoice was not created.");
      }

      await client.query(
        `
          insert into invoice_line_items (
            invoice_id,
            description,
            request_count,
            input_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
            output_tokens,
            total_tokens,
            amount_cents
          )
          select
            $1,
            'Model usage: ' || pl.model,
            count(*)::int,
            coalesce(sum(coalesce(pl.input_tokens, 0)), 0)::int,
            coalesce(sum(coalesce(pl.cache_creation_input_tokens, 0)), 0)::int,
            coalesce(sum(coalesce(pl.cache_read_input_tokens, 0)), 0)::int,
            coalesce(sum(coalesce(pl.output_tokens, 0)), 0)::int,
            coalesce(sum(
              coalesce(pl.input_tokens, 0) +
              coalesce(pl.cache_creation_input_tokens, 0) +
              coalesce(pl.cache_read_input_tokens, 0) +
              coalesce(pl.output_tokens, 0)
            ), 0)::int,
            0
          from prompt_logs pl
          where pl.organization_id = $2 and pl.created_at >= $3 and pl.created_at < $4
          group by pl.model
          order by pl.model
        `,
        [invoiceRow.id, input.organizationId, input.periodStart, input.periodEnd]
      );

      const lineItems = await client.query<InvoiceLineItemRow>(
        `
          select
            id,
            invoice_id,
            description,
            request_count,
            input_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
            output_tokens,
            total_tokens,
            amount_cents
          from invoice_line_items
          where invoice_id = $1
          order by description asc
        `,
        [invoiceRow.id]
      );

      await client.query("commit");
      return toInvoice(invoiceRow, lineItems.rows);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async listInvoices(): Promise<Invoice[]> {
    const invoices = await pool.query<InvoiceRow>(
      `
        select
          invoices.id,
          invoices.invoice_number,
          invoices.organization_id,
          organizations.name as organization_name,
          invoices.period_start,
          invoices.period_end,
          invoices.status,
          invoices.request_count,
          invoices.failed_request_count,
          invoices.subtotal_tokens,
          invoices.amount_cents,
          invoices.created_at
        from invoices
        join organizations on organizations.id = invoices.organization_id
        order by invoices.created_at desc
        limit 100
      `
    );

    if (invoices.rows.length === 0) {
      return [];
    }

    const lineItems = await pool.query<InvoiceLineItemRow>(
      `
        select
          id,
          invoice_id,
          description,
          request_count,
          input_tokens,
          cache_creation_input_tokens,
          cache_read_input_tokens,
          output_tokens,
          total_tokens,
          amount_cents
        from invoice_line_items
        where invoice_id = any($1::uuid[])
        order by description asc
      `,
      [invoices.rows.map((invoice) => invoice.id)]
    );

    return invoices.rows.map((invoice) => toInvoice(invoice, lineItems.rows));
  }

  private createInvoiceNumber() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `INV-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}

export const reportingRepository = new ReportingRepository();
