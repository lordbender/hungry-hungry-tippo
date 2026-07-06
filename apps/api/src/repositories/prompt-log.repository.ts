import { pool } from "../database/pool.js";
import type {
  CompletePromptLogInput,
  CreatePromptLogInput,
  FailPromptLogInput,
  PromptLog
} from "../models/prompt-log.model.js";

type PromptLogRow = {
  id: string;
  prompt: string;
  augmented_prompt: string | null;
  response: string | null;
  model: string;
  status: PromptLog["status"];
  latency_ms: number | null;
  input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

function toPromptLog(row: PromptLogRow): PromptLog {
  return {
    id: row.id,
    prompt: row.prompt,
    augmentedPrompt: row.augmented_prompt,
    response: row.response,
    model: row.model,
    status: row.status,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    cacheCreationInputTokens: row.cache_creation_input_tokens,
    cacheReadInputTokens: row.cache_read_input_tokens,
    outputTokens: row.output_tokens,
    errorMessage: row.error_message,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireRow(row: PromptLogRow | undefined): PromptLogRow {
  if (!row) {
    throw new Error("Expected prompt log row was not returned.");
  }

  return row;
}

export class PromptLogRepository {
  async create(input: CreatePromptLogInput): Promise<PromptLog> {
    const { rows } = await pool.query<PromptLogRow>(
      `
        insert into prompt_logs (prompt, augmented_prompt, model, status, metadata)
        values ($1, $2, $3, 'pending', $4)
        returning *
      `,
      [input.prompt, input.augmentedPrompt, input.model, input.metadata ?? {}]
    );

    return toPromptLog(requireRow(rows[0]));
  }

  async complete(input: CompletePromptLogInput): Promise<PromptLog> {
    const { rows } = await pool.query<PromptLogRow>(
      `
        update prompt_logs
        set response = $2,
            status = 'succeeded',
            latency_ms = $3,
            input_tokens = $4,
            cache_creation_input_tokens = $5,
            cache_read_input_tokens = $6,
            output_tokens = $7,
            metadata = metadata || $8::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [
        input.id,
        input.response,
        input.latencyMs,
        input.inputTokens,
        input.cacheCreationInputTokens,
        input.cacheReadInputTokens,
        input.outputTokens,
        input.metadata ?? {}
      ]
    );

    return toPromptLog(requireRow(rows[0]));
  }

  async fail(input: FailPromptLogInput): Promise<PromptLog> {
    const { rows } = await pool.query<PromptLogRow>(
      `
        update prompt_logs
        set status = 'failed',
            latency_ms = $2,
            error_message = $3,
            metadata = metadata || $4::jsonb,
            updated_at = now()
        where id = $1
        returning *
      `,
      [input.id, input.latencyMs, input.errorMessage, input.metadata ?? {}]
    );

    return toPromptLog(requireRow(rows[0]));
  }
}

export const promptLogRepository = new PromptLogRepository();
