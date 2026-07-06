import type { PromptRequest, PromptResponse } from "@hhh/contracts";
import { env } from "../config/env.js";
import { promptLogRepository } from "../repositories/prompt-log.repository.js";
import { promptResponseCacheRepository } from "../repositories/prompt-response-cache.repository.js";
import { ragSourceRepository } from "../repositories/rag-source.repository.js";
import { claudeService } from "./claude.service.js";
import { promptConductorService } from "./prompt-conductor.service.js";

export class PromptWorkflowService {
  async submitPrompt(request: PromptRequest): Promise<PromptResponse> {
    const startedAt = Date.now();
    const plan = promptConductorService.plan(request);
    const promptLog = await promptLogRepository.create({
      prompt: request.prompt,
      augmentedPrompt: plan.augmentedPrompt,
      model: env.CLAUDE_MODEL,
      metadata: {
        workflow: {
          requestedMode: plan.requestedMode,
          appliedMode: plan.appliedMode,
          rationale: plan.rationale,
          webSearchMaxUses: plan.webSearch.enabled ? plan.webSearch.maxUses : 0,
          promptCache: plan.promptCache
        }
      }
    });

    try {
      const cached = await promptResponseCacheRepository.findFresh({
        prompt: request.prompt,
        plan
      });

      if (cached) {
        const latencyMs = Date.now() - startedAt;

        await promptLogRepository.complete({
          id: promptLog.id,
          response: cached.response,
          latencyMs,
          inputTokens: 0,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          outputTokens: 0,
          metadata: {
            workflow: {
              requestedMode: plan.requestedMode,
              appliedMode: plan.appliedMode,
              rationale: plan.rationale,
              webSearchRequests: cached.workflow.webSearchRequests,
              citations: cached.workflow.citations,
              localCacheHit: true,
              promptCacheEnabled: env.CLAUDE_PROMPT_CACHE_ENABLED
            }
          }
        });

        return {
          ...cached,
          promptLogId: promptLog.id
        };
      }

      const completion = await claudeService.complete({
        prompt: request.prompt,
        systemPrompt: plan.systemPrompt,
        webSearch: plan.webSearch
      });
      const latencyMs = Date.now() - startedAt;
      const ragUpdate =
        plan.webSearch.enabled && completion.citations.length > 0
          ? await ragSourceRepository.storeWebSearchSources({
              promptLogId: promptLog.id,
              citations: completion.citations
            })
          : { documentsTouched: 0, chunksCreated: 0 };

      await promptLogRepository.complete({
        id: promptLog.id,
        response: completion.text,
        latencyMs,
        inputTokens: completion.inputTokens,
        cacheCreationInputTokens: completion.cacheCreationInputTokens,
        cacheReadInputTokens: completion.cacheReadInputTokens,
        outputTokens: completion.outputTokens,
        metadata: {
          workflow: {
            requestedMode: plan.requestedMode,
            appliedMode: plan.appliedMode,
            rationale: plan.rationale,
            webSearchRequests: completion.webSearchRequests,
            citations: completion.citations,
            ragUpdate,
            localCacheHit: false,
            promptCacheEnabled: env.CLAUDE_PROMPT_CACHE_ENABLED,
            promptCache: {
              cacheCreationInputTokens: completion.cacheCreationInputTokens,
              cacheReadInputTokens: completion.cacheReadInputTokens
            }
          }
        }
      });

      const response: PromptResponse = {
        promptLogId: promptLog.id,
        model: completion.model,
        response: completion.text,
        workflow: {
          requestedMode: plan.requestedMode,
          appliedMode: plan.appliedMode,
          webSearchRequests: completion.webSearchRequests,
          localCacheHit: false,
          citations: completion.citations,
          rationale: plan.rationale
        },
        usage: {
          inputTokens: completion.inputTokens,
          cacheCreationInputTokens: completion.cacheCreationInputTokens,
          cacheReadInputTokens: completion.cacheReadInputTokens,
          outputTokens: completion.outputTokens
        }
      };

      await promptResponseCacheRepository.store({
        prompt: request.prompt,
        plan,
        response
      });

      return response;
    } catch (error) {
      await promptLogRepository.fail({
        id: promptLog.id,
        latencyMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          workflow: {
            requestedMode: plan.requestedMode,
            appliedMode: plan.appliedMode,
            rationale: plan.rationale
          }
        }
      });
      throw error;
    }
  }
}

export const promptWorkflowService = new PromptWorkflowService();
