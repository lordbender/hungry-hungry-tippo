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
  pricing_plan_name: string | null;
  pricing_plan_version: number | null;
  currency: string;
  period_start: Date;
  period_end: Date;
  status: "draft" | "finalized" | "void";
  request_count: number;
  failed_request_count: number;
  subtotal_tokens: number;
  subtotal_credits: number;
  cost_per_credit_usd: string;
  price_per_credit_usd: string;
  markup_rate: string;
  cost_cents: number;
  amount_cents: number;
  created_at: Date;
  report_generated_at: Date | null;
};

type InvoiceLineItemRow = {
  id: string;
  invoice_id: string;
  user_id: string | null;
  module_id: string | null;
  module_key: string | null;
  module_name: string | null;
  pricing_rate_id: string | null;
  unit_name: string;
  description: string;
  request_count: number;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  credit_count: number;
  cost_per_credit_usd: string;
  price_per_credit_usd: string;
  markup_rate: string;
  cost_cents: number;
  amount_cents: number;
};

export type InvoiceReport = {
  invoiceId: string;
  filename: string;
  contentType: string;
  content: Buffer;
  generatedAt: Date;
};

type InvoiceReportRow = {
  invoice_id: string;
  filename: string;
  content_type: string;
  content: Buffer;
  generated_at: Date;
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

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
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
    pricingPlanName: row.pricing_plan_name,
    pricingPlanVersion: row.pricing_plan_version,
    currency: row.currency,
    periodStart: toIso(row.period_start),
    periodEnd: toIso(row.period_end),
    status: row.status,
    requestCount: row.request_count,
    failedRequestCount: row.failed_request_count,
    subtotalTokens: row.subtotal_tokens,
    subtotalCredits: row.subtotal_credits,
    costPerCreditUsd: toNumber(row.cost_per_credit_usd),
    pricePerCreditUsd: toNumber(row.price_per_credit_usd),
    markupRate: toNumber(row.markup_rate),
    costCents: row.cost_cents,
    amountCents: row.amount_cents,
    createdAt: toIso(row.created_at),
    reportGeneratedAt: row.report_generated_at ? toIso(row.report_generated_at) : null,
    lineItems: lineItems
      .filter((line) => line.invoice_id === row.id)
      .map((line) => ({
        id: line.id,
        userId: line.user_id,
        moduleId: line.module_id,
        moduleKey: line.module_key,
        moduleName: line.module_name,
        pricingRateId: line.pricing_rate_id,
        unitName: line.unit_name,
        description: line.description,
        requestCount: line.request_count,
        inputTokens: line.input_tokens,
        cacheCreationInputTokens: line.cache_creation_input_tokens,
        cacheReadInputTokens: line.cache_read_input_tokens,
        outputTokens: line.output_tokens,
        totalTokens: line.total_tokens,
        creditCount: line.credit_count,
        costPerCreditUsd: toNumber(line.cost_per_credit_usd),
        pricePerCreditUsd: toNumber(line.price_per_credit_usd),
        markupRate: toNumber(line.markup_rate),
        costCents: line.cost_cents,
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

      const pricing = await client.query<{
        plan_version_id: string;
        pricing_plan_name: string;
        pricing_plan_version: number;
        currency: string;
        pricing_snapshot: Record<string, unknown>;
      }>(
        `
          with selected_profile as (
            insert into organization_billing_profiles (organization_id, plan_version_id)
            select $1, ppv.id
            from pricing_plan_versions ppv
            join pricing_plans pp on pp.id = ppv.plan_id
            where pp.plan_key = 'production-standard'
              and ppv.status = 'active'
              and ppv.effective_at <= $2
              and (ppv.retired_at is null or ppv.retired_at > $2)
            order by ppv.effective_at desc, ppv.version desc
            limit 1
            on conflict (organization_id) do update
            set updated_at = organization_billing_profiles.updated_at
            returning plan_version_id
          ),
          plan_context as (
            select
              ppv.id as plan_version_id,
              pp.name as pricing_plan_name,
              ppv.version as pricing_plan_version,
              pp.currency,
              jsonb_build_object(
                'planKey', pp.plan_key,
                'planName', pp.name,
                'planVersion', ppv.version,
                'currency', pp.currency,
                'effectiveAt', ppv.effective_at,
                'costComponents', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'componentKey', pcc.component_key,
                      'name', pcc.name,
                      'category', pcc.category,
                      'monthlyCostCents', pcc.monthly_cost_cents,
                      'unitCostUsd', pcc.unit_cost_usd,
                      'allocationMethod', pcc.allocation_method
                    )
                    order by pcc.category, pcc.component_key
                  )
                  from pricing_cost_components pcc
                  where pcc.plan_version_id = ppv.id
                ), '[]'::jsonb),
                'rates', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'moduleKey', bm.module_key,
                      'moduleName', bm.name,
                      'unitName', pr.unit_name,
                      'costPerUnitUsd', pr.cost_per_unit_usd,
                      'markupRate', pr.markup_rate,
                      'pricePerUnitUsd', pr.price_per_unit_usd
                    )
                    order by bm.module_key, pr.unit_name
                  )
                  from pricing_rates pr
                  join billing_modules bm on bm.id = pr.module_id
                  where pr.plan_version_id = ppv.id
                ), '[]'::jsonb)
              ) as pricing_snapshot
            from selected_profile sp
            join pricing_plan_versions ppv on ppv.id = sp.plan_version_id
            join pricing_plans pp on pp.id = ppv.plan_id
          )
          select *
          from plan_context
        `,
        [input.organizationId, input.periodStart]
      );

      const pricingRow = pricing.rows[0];
      if (!pricingRow) {
        throw new Error("No active pricing plan is configured.");
      }

      const totals = await client.query<{
        request_count: number;
        failed_request_count: number;
        subtotal_tokens: number;
        subtotal_credits: number;
        cost_cents: number;
        amount_cents: number;
      }>(
        `
          with prompt_totals as (
            select
              count(distinct pl.id)::int as request_count,
              count(distinct pl.id) filter (where pl.status = 'failed')::int as failed_request_count
            from prompt_logs pl
            where pl.organization_id = $1
              and pl.created_at >= $2
              and pl.created_at < $3
          ),
          usage_totals as (
            select
              coalesce(sum(mue.total_tokens), 0)::int as subtotal_tokens,
              coalesce(sum(mue.unit_count), 0)::int as subtotal_credits,
              coalesce(sum(mue.cost_cents), 0)::int as cost_cents,
              coalesce(sum(mue.amount_cents), 0)::int as amount_cents
            from module_usage_events mue
            where mue.organization_id = $1
              and mue.occurred_at >= $2
              and mue.occurred_at < $3
          )
          select *
          from prompt_totals
          cross join usage_totals
        `,
        [input.organizationId, input.periodStart, input.periodEnd]
      );

      const summary = totals.rows[0] ?? {
        request_count: 0,
        failed_request_count: 0,
        subtotal_tokens: 0,
        subtotal_credits: 0,
        cost_cents: 0,
        amount_cents: 0
      };

      const invoice = await client.query<InvoiceRow>(
        `
          insert into invoices (
            invoice_number,
            organization_id,
            plan_version_id,
            period_start,
            period_end,
            request_count,
            failed_request_count,
            subtotal_tokens,
            subtotal_credits,
            cost_per_credit_usd,
            price_per_credit_usd,
            markup_rate,
            cost_cents,
            amount_cents,
            pricing_snapshot,
            created_by_user_id
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, 0, $10, $11, $12, $13)
          returning
            id,
            invoice_number,
            organization_id,
            (select name from organizations where id = invoices.organization_id) as organization_name,
            $14::text as pricing_plan_name,
            $15::int as pricing_plan_version,
            $16::text as currency,
            period_start,
            period_end,
            status,
            request_count,
            failed_request_count,
            subtotal_tokens,
            subtotal_credits,
            cost_per_credit_usd,
            price_per_credit_usd,
            markup_rate,
            cost_cents,
            amount_cents,
            null::timestamptz as report_generated_at,
            created_at
        `,
        [
          invoiceNumber,
          input.organizationId,
          pricingRow.plan_version_id,
          input.periodStart,
          input.periodEnd,
          summary.request_count,
          summary.failed_request_count,
          summary.subtotal_tokens,
          summary.subtotal_credits,
          summary.cost_cents,
          summary.amount_cents,
          pricingRow.pricing_snapshot,
          input.createdByUserId ?? null,
          pricingRow.pricing_plan_name,
          pricingRow.pricing_plan_version,
          pricingRow.currency
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
            user_id,
            module_id,
            pricing_rate_id,
            unit_name,
            description,
            request_count,
            input_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
            output_tokens,
            total_tokens,
            credit_count,
            cost_per_credit_usd,
            price_per_credit_usd,
            markup_rate,
            cost_cents,
            amount_cents,
            pricing_snapshot
          )
          with usage_lines as (
            select
              users.id as user_id,
              users.username,
              bm.id as module_id,
              bm.module_key,
              bm.name as module_name,
              mue.pricing_rate_id,
              mue.unit_name,
              count(*)::int as request_count,
              coalesce(sum(mue.input_tokens), 0)::int as input_tokens,
              coalesce(sum(mue.cache_creation_input_tokens), 0)::int as cache_creation_input_tokens,
              coalesce(sum(mue.cache_read_input_tokens), 0)::int as cache_read_input_tokens,
              coalesce(sum(mue.output_tokens), 0)::int as output_tokens,
              coalesce(sum(mue.total_tokens), 0)::int as total_tokens,
              coalesce(sum(mue.unit_count), 0)::int as unit_count,
              mue.cost_per_unit_usd,
              mue.price_per_unit_usd,
              mue.markup_rate,
              coalesce(sum(mue.cost_cents), 0)::int as cost_cents,
              coalesce(sum(mue.amount_cents), 0)::int as amount_cents
            from module_usage_events mue
            join app_users users on users.id = mue.user_id
            join billing_modules bm on bm.id = mue.module_id
            where mue.organization_id = $2
              and mue.occurred_at >= $3
              and mue.occurred_at < $4
            group by
              users.id,
              users.username,
              bm.id,
              bm.module_key,
              bm.name,
              mue.pricing_rate_id,
              mue.unit_name,
              mue.cost_per_unit_usd,
              mue.price_per_unit_usd,
              mue.markup_rate
          )
          select
            $1,
            user_id,
            module_id,
            pricing_rate_id,
            unit_name,
            username || ' - ' || module_name || ' (' || unit_name || ')',
            request_count,
            input_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
            output_tokens,
            total_tokens,
            unit_count,
            cost_per_unit_usd,
            price_per_unit_usd,
            markup_rate,
            cost_cents,
            amount_cents,
            jsonb_build_object(
              'moduleKey', module_key,
              'moduleName', module_name,
              'unitName', unit_name,
              'costPerUnitUsd', cost_per_unit_usd,
              'pricePerUnitUsd', price_per_unit_usd,
              'markupRate', markup_rate
            )
          from usage_lines
          order by username, module_name, unit_name
        `,
        [invoiceRow.id, input.organizationId, input.periodStart, input.periodEnd]
      );

      const lineItems = await this.listInvoiceLineItems([invoiceRow.id]);

      await client.query("commit");
      return toInvoice(invoiceRow, lineItems);
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
          pricing_plans.name as pricing_plan_name,
          pricing_plan_versions.version as pricing_plan_version,
          coalesce(pricing_plans.currency, 'USD') as currency,
          invoices.period_start,
          invoices.period_end,
          invoices.status,
          invoices.request_count,
          invoices.failed_request_count,
          invoices.subtotal_tokens,
          invoices.subtotal_credits,
          invoices.cost_per_credit_usd,
          invoices.price_per_credit_usd,
          invoices.markup_rate,
          invoices.cost_cents,
          invoices.amount_cents,
          invoices.created_at,
          invoice_reports.generated_at as report_generated_at
        from invoices
        join organizations on organizations.id = invoices.organization_id
        left join pricing_plan_versions on pricing_plan_versions.id = invoices.plan_version_id
        left join pricing_plans on pricing_plans.id = pricing_plan_versions.plan_id
        left join invoice_reports on invoice_reports.invoice_id = invoices.id
        order by invoices.created_at desc
        limit 100
      `
    );

    if (invoices.rows.length === 0) {
      return [];
    }

    const lineItems = await this.listInvoiceLineItems(invoices.rows.map((invoice) => invoice.id));

    return invoices.rows.map((invoice) => toInvoice(invoice, lineItems));
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    const invoices = await pool.query<InvoiceRow>(
      `
        select
          invoices.id,
          invoices.invoice_number,
          invoices.organization_id,
          organizations.name as organization_name,
          pricing_plans.name as pricing_plan_name,
          pricing_plan_versions.version as pricing_plan_version,
          coalesce(pricing_plans.currency, 'USD') as currency,
          invoices.period_start,
          invoices.period_end,
          invoices.status,
          invoices.request_count,
          invoices.failed_request_count,
          invoices.subtotal_tokens,
          invoices.subtotal_credits,
          invoices.cost_per_credit_usd,
          invoices.price_per_credit_usd,
          invoices.markup_rate,
          invoices.cost_cents,
          invoices.amount_cents,
          invoices.created_at,
          invoice_reports.generated_at as report_generated_at
        from invoices
        join organizations on organizations.id = invoices.organization_id
        left join pricing_plan_versions on pricing_plan_versions.id = invoices.plan_version_id
        left join pricing_plans on pricing_plans.id = pricing_plan_versions.plan_id
        left join invoice_reports on invoice_reports.invoice_id = invoices.id
        where invoices.id = $1
      `,
      [invoiceId]
    );

    const invoice = invoices.rows[0];
    if (!invoice) {
      return null;
    }

    const lineItems = await this.listInvoiceLineItems([invoice.id]);
    return toInvoice(invoice, lineItems);
  }

  async getInvoiceReport(invoiceId: string): Promise<InvoiceReport | null> {
    const { rows } = await pool.query<InvoiceReportRow>(
      `
        select invoice_id, filename, content_type, content, generated_at
        from invoice_reports
        where invoice_id = $1
      `,
      [invoiceId]
    );

    return rows[0] ? toInvoiceReport(rows[0]) : null;
  }

  async storeInvoiceReport(input: {
    invoiceId: string;
    filename: string;
    contentType: string;
    content: Buffer;
  }): Promise<InvoiceReport> {
    const { rows } = await pool.query<InvoiceReportRow>(
      `
        insert into invoice_reports (invoice_id, filename, content_type, content)
        values ($1, $2, $3, $4)
        on conflict (invoice_id) do update
        set filename = invoice_reports.filename
        returning invoice_id, filename, content_type, content, generated_at
      `,
      [input.invoiceId, input.filename, input.contentType, input.content]
    );

    const report = rows[0];
    if (!report) {
      throw new Error("Invoice report was not stored.");
    }

    return toInvoiceReport(report);
  }

  private createInvoiceNumber() {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    return `INV-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private async listInvoiceLineItems(invoiceIds: string[]): Promise<InvoiceLineItemRow[]> {
    if (invoiceIds.length === 0) {
      return [];
    }

    const { rows } = await pool.query<InvoiceLineItemRow>(
      `
        select
          invoice_line_items.id,
          invoice_line_items.invoice_id,
          invoice_line_items.user_id,
          invoice_line_items.module_id,
          billing_modules.module_key,
          billing_modules.name as module_name,
          invoice_line_items.pricing_rate_id,
          invoice_line_items.unit_name,
          invoice_line_items.description,
          invoice_line_items.request_count,
          invoice_line_items.input_tokens,
          invoice_line_items.cache_creation_input_tokens,
          invoice_line_items.cache_read_input_tokens,
          invoice_line_items.output_tokens,
          invoice_line_items.total_tokens,
          invoice_line_items.credit_count,
          invoice_line_items.cost_per_credit_usd,
          invoice_line_items.price_per_credit_usd,
          invoice_line_items.markup_rate,
          invoice_line_items.cost_cents,
          invoice_line_items.amount_cents
        from invoice_line_items
        left join billing_modules on billing_modules.id = invoice_line_items.module_id
        where invoice_line_items.invoice_id = any($1::uuid[])
        order by invoice_line_items.description asc
      `,
      [invoiceIds]
    );

    return rows;
  }
}

export const reportingRepository = new ReportingRepository();

function toInvoiceReport(row: InvoiceReportRow): InvoiceReport {
  return {
    invoiceId: row.invoice_id,
    filename: row.filename,
    contentType: row.content_type,
    content: row.content,
    generatedAt: row.generated_at
  };
}
