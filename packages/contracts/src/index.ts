import { z } from "zod";

export const AugmentationModeSchema = z.enum(["auto", "direct", "web_search"]);

export const CitationSchema = z.object({
  title: z.string().nullable(),
  url: z.string().url(),
  citedText: z.string().nullable()
});

export const PromptRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required").max(12000, "Prompt is too long"),
  augmentationMode: AugmentationModeSchema.default("auto")
});

export const PromptResponseSchema = z.object({
  promptLogId: z.string().uuid(),
  model: z.string(),
  response: z.string(),
  workflow: z.object({
    requestedMode: AugmentationModeSchema,
    appliedMode: z.enum(["direct", "web_search"]),
    webSearchRequests: z.number().int().nonnegative(),
    citations: z.array(CitationSchema),
    rationale: z.string()
  }),
  usage: z.object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable()
  })
});

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string()
  })
});

export type AugmentationMode = z.infer<typeof AugmentationModeSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type PromptRequest = z.infer<typeof PromptRequestSchema>;
export type PromptResponse = z.infer<typeof PromptResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
