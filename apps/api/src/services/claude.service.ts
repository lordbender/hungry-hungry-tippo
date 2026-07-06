import Anthropic from "@anthropic-ai/sdk";
import type { Citation } from "@hhh/contracts";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

export interface ClaudeCompletionInput {
  prompt: string;
  systemPrompt: string;
  webSearch?: {
    enabled: boolean;
    maxUses: number;
  };
}

export interface ClaudeCompletion {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  webSearchRequests: number;
  citations: Citation[];
}

export class ClaudeService {
  private readonly client: Anthropic | null;

  constructor() {
    this.client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  }

  async complete(input: ClaudeCompletionInput): Promise<ClaudeCompletion> {
    if (!this.client) {
      throw new AppError(
        "CLAUDE_API_KEY_MISSING",
        "ANTHROPIC_API_KEY is required before prompts can be submitted.",
        503
      );
    }

    const message = await this.client.messages.create({
      model: env.CLAUDE_MODEL,
      max_tokens: env.CLAUDE_MAX_TOKENS,
      system: input.systemPrompt,
      messages: [{ role: "user", content: input.prompt }],
      tools: input.webSearch?.enabled
        ? [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: input.webSearch.maxUses
            }
          ]
        : undefined,
      tool_choice: input.webSearch?.enabled ? { type: "tool", name: "web_search" } : undefined
    });

    const textBlocks = message.content.filter((block) => block.type === "text");

    return {
      text: textBlocks.map((block) => block.text).join("\n"),
      model: message.model,
      inputTokens: message.usage?.input_tokens ?? null,
      outputTokens: message.usage?.output_tokens ?? null,
      webSearchRequests: message.usage?.server_tool_use?.web_search_requests ?? 0,
      citations: uniqueCitations(
        textBlocks.flatMap((block) =>
          (block.citations ?? [])
            .filter((citation) => citation.type === "web_search_result_location")
            .map((citation) => ({
              title: citation.title,
              url: citation.url,
              citedText: citation.cited_text
            }))
        )
      )
    };
  }
}

function uniqueCitations(citations: Citation[]) {
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.url}:${citation.citedText ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export const claudeService = new ClaudeService();
