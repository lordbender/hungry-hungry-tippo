export type PromptLogStatus = "pending" | "succeeded" | "failed";

export interface PromptLog {
  id: string;
  prompt: string;
  augmentedPrompt: string | null;
  response: string | null;
  model: string;
  status: PromptLogStatus;
  latencyMs: number | null;
  inputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  outputTokens: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePromptLogInput {
  prompt: string;
  augmentedPrompt: string;
  model: string;
  metadata?: Record<string, unknown>;
}

export interface CompletePromptLogInput {
  id: string;
  response: string;
  latencyMs: number;
  inputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
  outputTokens: number | null;
  metadata?: Record<string, unknown>;
}

export interface FailPromptLogInput {
  id: string;
  latencyMs: number;
  errorMessage: string;
  metadata?: Record<string, unknown>;
}
