import { pool } from "../database/pool.js";

export interface RecordModuleUsageInput {
  organizationId: string;
  userId: string;
  sessionId: string;
  promptLogId?: string;
  moduleKey: string;
  unitName?: string;
  unitCount: number;
  inputTokens?: number | null;
  cacheCreationInputTokens?: number | null;
  cacheReadInputTokens?: number | null;
  outputTokens?: number | null;
  conductorRunId?: string;
  bpmnProcessId?: string;
  bpmnActivityId?: string;
  metadata?: Record<string, unknown>;
}

type ModuleUsageRow = {
  id: string;
};

export class ModuleUsageRepository {
  async record(input: RecordModuleUsageInput): Promise<string | null> {
    if (input.unitCount <= 0) {
      return null;
    }

    const inputTokens = input.inputTokens ?? 0;
    const cacheCreationInputTokens = input.cacheCreationInputTokens ?? 0;
    const cacheReadInputTokens = input.cacheReadInputTokens ?? 0;
    const outputTokens = input.outputTokens ?? 0;
    const totalTokens = inputTokens + cacheCreationInputTokens + cacheReadInputTokens + outputTokens;

    const { rows } = await pool.query<ModuleUsageRow>(
      `
        with selected_module as (
          select id, default_unit_name
          from billing_modules
          where module_key = $5
        ),
        selected_profile as (
          insert into organization_billing_profiles (organization_id, plan_version_id)
          select $1, ppv.id
          from pricing_plan_versions ppv
          join pricing_plans pp on pp.id = ppv.plan_id
          where pp.plan_key = 'production-standard'
            and ppv.status = 'active'
            and ppv.effective_at <= now()
            and (ppv.retired_at is null or ppv.retired_at > now())
          order by ppv.effective_at desc, ppv.version desc
          limit 1
          on conflict (organization_id) do update
          set updated_at = organization_billing_profiles.updated_at
          returning plan_version_id
        ),
        resolved_profile as (
          select plan_version_id
          from selected_profile
          union all
          select plan_version_id
          from organization_billing_profiles
          where organization_id = $1
          limit 1
        ),
        selected_rate as (
          select
            pr.id,
            pr.module_id,
            pr.unit_name,
            pr.cost_per_unit_usd,
            pr.price_per_unit_usd,
            pr.markup_rate
          from pricing_rates pr
          join selected_module sm on sm.id = pr.module_id
          where pr.plan_version_id = (select plan_version_id from resolved_profile)
            and pr.unit_name = coalesce($6, sm.default_unit_name)
        )
        insert into module_usage_events (
          organization_id,
          user_id,
          session_id,
          prompt_log_id,
          module_id,
          pricing_rate_id,
          conductor_run_id,
          bpmn_process_id,
          bpmn_activity_id,
          unit_name,
          unit_count,
          input_tokens,
          cache_creation_input_tokens,
          cache_read_input_tokens,
          output_tokens,
          total_tokens,
          cost_per_unit_usd,
          price_per_unit_usd,
          markup_rate,
          cost_cents,
          amount_cents,
          metadata
        )
        select
          $1,
          $2,
          $3,
          $4,
          selected_rate.module_id,
          selected_rate.id,
          $7,
          $8,
          $9,
          selected_rate.unit_name,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          selected_rate.cost_per_unit_usd,
          selected_rate.price_per_unit_usd,
          selected_rate.markup_rate,
          round($10 * selected_rate.cost_per_unit_usd * 100)::int,
          round($10 * selected_rate.price_per_unit_usd * 100)::int,
          $16::jsonb
        from selected_rate
        on conflict (prompt_log_id, module_id, unit_name, bpmn_activity_id) do update
        set unit_count = excluded.unit_count,
            input_tokens = excluded.input_tokens,
            cache_creation_input_tokens = excluded.cache_creation_input_tokens,
            cache_read_input_tokens = excluded.cache_read_input_tokens,
            output_tokens = excluded.output_tokens,
            total_tokens = excluded.total_tokens,
            cost_per_unit_usd = excluded.cost_per_unit_usd,
            price_per_unit_usd = excluded.price_per_unit_usd,
            markup_rate = excluded.markup_rate,
            cost_cents = excluded.cost_cents,
            amount_cents = excluded.amount_cents,
            metadata = module_usage_events.metadata || excluded.metadata
        returning id
      `,
      [
        input.organizationId,
        input.userId,
        input.sessionId,
        input.promptLogId ?? null,
        input.moduleKey,
        input.unitName ?? null,
        input.conductorRunId ?? null,
        input.bpmnProcessId ?? "prompt-workflow",
        input.bpmnActivityId ?? input.moduleKey,
        input.unitCount,
        inputTokens,
        cacheCreationInputTokens,
        cacheReadInputTokens,
        outputTokens,
        totalTokens,
        input.metadata ?? {}
      ]
    );

    return rows[0]?.id ?? null;
  }
}

export const moduleUsageRepository = new ModuleUsageRepository();
