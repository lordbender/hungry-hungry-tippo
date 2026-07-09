import type { PromptRequest, PromptResponse } from "@hhh/contracts";
import { env } from "../config/env.js";
import { billingContextRepository } from "../repositories/billing-context.repository.js";
import { moduleUsageRepository } from "../repositories/module-usage.repository.js";
import { promptLogRepository } from "../repositories/prompt-log.repository.js";
import { promptResponseCacheRepository } from "../repositories/prompt-response-cache.repository.js";
import { ragSourceRepository } from "../repositories/rag-source.repository.js";
import { claudeService } from "./claude.service.js";
import { promptConductorService } from "./prompt-conductor.service.js";

export class PromptWorkflowService {
  async submitPrompt(
    request: PromptRequest,
    actor?: {
      subject: string;
      username?: string;
      email?: string;
      roles: string[];
      organizationName?: string;
      organizationSlug?: string;
      billingEmail?: string;
    }
  ): Promise<PromptResponse> {
    const startedAt = Date.now();
    const plan = promptConductorService.plan(request);
    const billingContext = await billingContextRepository.resolve({
      actor,
      clientSessionId: request.sessionId
    });
    const promptLog = await promptLogRepository.create({
      prompt: request.prompt,
      augmentedPrompt: plan.augmentedPrompt,
      model: env.CLAUDE_MODEL,
      organizationId: billingContext.organization.id,
      userId: billingContext.user.id,
      sessionId: billingContext.session.id,
      metadata: {
        workflow: {
          requestedMode: plan.requestedMode,
          appliedMode: plan.appliedMode,
          rationale: plan.rationale,
          webSearchMaxUses: plan.webSearch.enabled ? plan.webSearch.maxUses : 0,
          promptCache: plan.promptCache,
          actor,
          billing: {
            organizationId: billingContext.organization.id,
            userId: billingContext.user.id,
            sessionId: billingContext.session.id,
            clientSessionId: billingContext.session.clientSessionId
          }
        }
      }
    });

    try {
      await moduleUsageRepository.record({
        organizationId: billingContext.organization.id,
        userId: billingContext.user.id,
        sessionId: billingContext.session.id,
        promptLogId: promptLog.id,
        moduleKey: "prompt_workflow",
        unitName: "request",
        unitCount: 1,
        bpmnProcessId: "prompt-workflow",
        bpmnActivityId: "prompt-workflow:start",
        metadata: {
          requestedMode: plan.requestedMode,
          appliedMode: plan.appliedMode
        }
      });

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

        await moduleUsageRepository.record({
          organizationId: billingContext.organization.id,
          userId: billingContext.user.id,
          sessionId: billingContext.session.id,
          promptLogId: promptLog.id,
          moduleKey: "local_response_cache",
          unitName: "request",
          unitCount: 1,
          bpmnProcessId: "prompt-workflow",
          bpmnActivityId: "prompt-workflow:cache-hit",
          metadata: {
            localCacheHit: true
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

      const totalCompletionTokens =
        (completion.inputTokens ?? 0) +
        (completion.cacheCreationInputTokens ?? 0) +
        (completion.cacheReadInputTokens ?? 0) +
        (completion.outputTokens ?? 0);

      await moduleUsageRepository.record({
        organizationId: billingContext.organization.id,
        userId: billingContext.user.id,
        sessionId: billingContext.session.id,
        promptLogId: promptLog.id,
        moduleKey: "claude_completion",
        unitName: "credit",
        unitCount: totalCompletionTokens,
        inputTokens: completion.inputTokens,
        cacheCreationInputTokens: completion.cacheCreationInputTokens,
        cacheReadInputTokens: completion.cacheReadInputTokens,
        outputTokens: completion.outputTokens,
        bpmnProcessId: "prompt-workflow",
        bpmnActivityId: "prompt-workflow:claude-completion",
        metadata: {
          model: completion.model
        }
      });

      await moduleUsageRepository.record({
        organizationId: billingContext.organization.id,
        userId: billingContext.user.id,
        sessionId: billingContext.session.id,
        promptLogId: promptLog.id,
        moduleKey: "web_search",
        unitName: "request",
        unitCount: completion.webSearchRequests,
        bpmnProcessId: "prompt-workflow",
        bpmnActivityId: "prompt-workflow:web-search",
        metadata: {
          citationCount: completion.citations.length
        }
      });

      await moduleUsageRepository.record({
        organizationId: billingContext.organization.id,
        userId: billingContext.user.id,
        sessionId: billingContext.session.id,
        promptLogId: promptLog.id,
        moduleKey: "rag_context",
        unitName: "credit",
        unitCount: ragUpdate.chunksCreated,
        bpmnProcessId: "prompt-workflow",
        bpmnActivityId: "prompt-workflow:rag-context",
        metadata: {
          documentsTouched: ragUpdate.documentsTouched,
          chunksCreated: ragUpdate.chunksCreated
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
