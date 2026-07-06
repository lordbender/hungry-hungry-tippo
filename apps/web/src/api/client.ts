import {
  ApiErrorResponseSchema,
  PromptResponseSchema,
  type PromptRequest,
  type PromptResponse
} from "@hhh/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function submitPrompt(request: PromptRequest): Promise<PromptResponse> {
  const response = await fetch(`${apiBaseUrl}/api/prompts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const parsed = ApiErrorResponseSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error.message : "Prompt submission failed.");
  }

  return PromptResponseSchema.parse(payload);
}
