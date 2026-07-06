import type { AugmentationMode, PromptRequest } from "@hhh/contracts";
import { env } from "../config/env.js";

export type AppliedAugmentationMode = "direct" | "web_search";

export interface PromptPlan {
  requestedMode: AugmentationMode;
  appliedMode: AppliedAugmentationMode;
  rationale: string;
  systemPrompt: string;
  augmentedPrompt: string;
  webSearch: {
    enabled: boolean;
    maxUses: number;
  };
}

const liveContextPatterns = [
  /\b(real[-\s]?time|current|currently|today|latest|recent|now)\b/i,
  /\b(search|browse|internet|web|online|look up|lookup)\b/i,
  /\b(news|price|pricing|weather|score|schedule|stock|exchange rate)\b/i,
  /\b(version|release|changelog|availability|enabled|enable|docs?|documentation)\b/i
];

function shouldUseWebSearch(prompt: string) {
  return liveContextPatterns.some((pattern) => pattern.test(prompt));
}

function buildSystemPrompt(appliedMode: AppliedAugmentationMode) {
  const base = [
    "You are the answering model inside an agentic workflow.",
    "The workflow may augment the user's prompt with retrieval tools before you answer.",
    "Be direct about what information came from current retrieval versus general reasoning.",
    "If citations are available from web search, rely on them for claims about current capabilities, settings, prices, dates, docs, or live availability."
  ];

  if (appliedMode === "web_search") {
    base.push(
      "You have access to a web_search tool for current information.",
      "Run at least one web_search before your final answer.",
      "Use a targeted query based on the user's prompt, then ground current or platform-specific claims in the search results.",
      "Do not say you cannot browse if the web_search tool is available; instead, use it when it helps answer the user's question."
    );
  } else {
    base.push(
      "No retrieval tool is enabled for this request. Answer from stable knowledge and clearly state when current information would need retrieval."
    );
  }

  return base.join("\n");
}

function buildAugmentedPrompt(input: {
  originalPrompt: string;
  requestedMode: AugmentationMode;
  appliedMode: AppliedAugmentationMode;
  rationale: string;
  systemPrompt: string;
  webSearch: {
    enabled: boolean;
    maxUses: number;
  };
}) {
  return [
    "=== Agentic Workflow Prompt Envelope ===",
    "",
    "## Workflow Plan",
    `Requested mode: ${input.requestedMode}`,
    `Applied mode: ${input.appliedMode}`,
    `Rationale: ${input.rationale}`,
    "",
    "## Retrieval Tools",
    input.webSearch.enabled
      ? `Claude server tool enabled: web_search_20250305, max_uses=${input.webSearch.maxUses}, tool_choice=web_search`
      : "No retrieval tool enabled for this request.",
    "",
    "## System Prompt",
    input.systemPrompt,
    "",
    "## User Prompt",
    input.originalPrompt
  ].join("\n");
}

export class PromptConductorService {
  plan(request: PromptRequest): PromptPlan {
    const requestedMode = request.augmentationMode;
    const appliedMode =
      requestedMode === "web_search" || (requestedMode === "auto" && shouldUseWebSearch(request.prompt))
        ? "web_search"
        : "direct";

    const webSearchEnabled = appliedMode === "web_search" && env.CLAUDE_WEB_SEARCH_ENABLED;

    const finalAppliedMode = webSearchEnabled ? "web_search" : "direct";
    const rationale = this.rationale(requestedMode, appliedMode, webSearchEnabled);
    const systemPrompt = buildSystemPrompt(finalAppliedMode);
    const webSearch = {
      enabled: webSearchEnabled,
      maxUses: env.CLAUDE_WEB_SEARCH_MAX_USES
    };

    return {
      requestedMode,
      appliedMode: finalAppliedMode,
      rationale,
      systemPrompt,
      augmentedPrompt: buildAugmentedPrompt({
        originalPrompt: request.prompt,
        requestedMode,
        appliedMode: finalAppliedMode,
        rationale,
        systemPrompt,
        webSearch
      }),
      webSearch
    };
  }

  private rationale(
    requestedMode: AugmentationMode,
    plannedMode: AppliedAugmentationMode,
    webSearchEnabled: boolean
  ) {
    if (requestedMode === "direct") {
      return "Direct mode was requested, so no retrieval tool was enabled.";
    }

    if (plannedMode === "web_search" && webSearchEnabled) {
      return requestedMode === "web_search"
        ? "Web search was explicitly requested for this prompt."
        : "Auto mode detected that the prompt may depend on current or internet-accessible information.";
    }

    if (plannedMode === "web_search" && !webSearchEnabled) {
      return "Auto mode selected web search, but CLAUDE_WEB_SEARCH_ENABLED is disabled.";
    }

    return "Auto mode did not detect a need for live retrieval, so the prompt was sent directly.";
  }
}

export const promptConductorService = new PromptConductorService();
