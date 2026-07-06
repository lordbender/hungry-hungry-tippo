import crypto from "node:crypto";
import type { PromptResponse } from "@hhh/contracts";
import { env } from "../config/env.js";
import { pool } from "../database/pool.js";
import type { PromptPlan } from "../services/prompt-conductor.service.js";

export interface PromptResponseCacheLookupInput {
  prompt: string;
  plan: PromptPlan;
}

export interface PromptResponseCacheStoreInput extends PromptResponseCacheLookupInput {
  response: PromptResponse;
}

type PromptResponseCacheRow = {
  response: string;
  workflow: PromptResponse["workflow"];
};

export class PromptResponseCacheRepository {
  buildCacheKey(input: PromptResponseCacheLookupInput) {
    const cachePayload = {
      model: env.CLAUDE_MODEL,
      maxTokens: env.CLAUDE_MAX_TOKENS,
      prompt: input.prompt,
      requestedMode: input.plan.requestedMode,
      appliedMode: input.plan.appliedMode,
      systemPrompt: input.plan.systemPrompt,
      webSearch: input.plan.webSearch,
      claudePromptCacheEnabled: env.CLAUDE_PROMPT_CACHE_ENABLED
    };

    return crypto.createHash("sha256").update(JSON.stringify(cachePayload)).digest("hex");
  }

  async findFresh(input: PromptResponseCacheLookupInput): Promise<PromptResponse | null> {
    if (!env.LOCAL_RESPONSE_CACHE_ENABLED) {
      return null;
    }

    const cacheKey = this.buildCacheKey(input);
    const { rows } = await pool.query<PromptResponseCacheRow>(
      `
        update prompt_response_cache
        set hit_count = hit_count + 1,
            updated_at = now()
        where cache_key = $1
          and expires_at > now()
        returning response, workflow, usage
      `,
      [cacheKey]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      promptLogId: crypto.randomUUID(),
      model: env.CLAUDE_MODEL,
      response: row.response,
      workflow: {
        ...row.workflow,
        localCacheHit: true
      },
      usage: {
        inputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        outputTokens: 0
      }
    };
  }

  async store(input: PromptResponseCacheStoreInput) {
    if (!env.LOCAL_RESPONSE_CACHE_ENABLED) {
      return;
    }

    const cacheKey = this.buildCacheKey(input);

    await pool.query(
      `
        insert into prompt_response_cache (
          cache_key,
          model,
          prompt,
          augmentation_mode,
          response,
          workflow,
          usage,
          metadata,
          expires_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          now() + ($9 || ' seconds')::interval
        )
        on conflict (cache_key)
        do update set
          response = excluded.response,
          workflow = excluded.workflow,
          usage = excluded.usage,
          metadata = excluded.metadata,
          updated_at = now(),
          expires_at = excluded.expires_at
      `,
      [
        cacheKey,
        env.CLAUDE_MODEL,
        input.prompt,
        input.plan.requestedMode,
        input.response.response,
        input.response.workflow,
        input.response.usage,
        {
          appliedMode: input.plan.appliedMode,
          ttlSeconds: env.LOCAL_RESPONSE_CACHE_TTL_SECONDS
        },
        env.LOCAL_RESPONSE_CACHE_TTL_SECONDS
      ]
    );
  }
}

export const promptResponseCacheRepository = new PromptResponseCacheRepository();
