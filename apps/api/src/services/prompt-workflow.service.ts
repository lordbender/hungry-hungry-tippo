import type { PromptRequest, PromptResponse } from "@hhh/contracts";
import { env } from "../config/env.js";
import { promptLogRepository } from "../repositories/prompt-log.repository.js";
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
          webSearchMaxUses: plan.webSearch.enabled ? plan.webSearch.maxUses : 0
        }
      }
    });

    try {
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
        outputTokens: completion.outputTokens,
        metadata: {
          workflow: {
            requestedMode: plan.requestedMode,
            appliedMode: plan.appliedMode,
            rationale: plan.rationale,
            webSearchRequests: completion.webSearchRequests,
            citations: completion.citations,
            ragUpdate
          }
        }
      });

      return {
        promptLogId: promptLog.id,
        model: completion.model,
        response: completion.text,
        workflow: {
          requestedMode: plan.requestedMode,
          appliedMode: plan.appliedMode,
          webSearchRequests: completion.webSearchRequests,
          citations: completion.citations,
          rationale: plan.rationale
        },
        usage: {
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens
        }
      };
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
