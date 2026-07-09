import { Alert, Box, Container, Stack, Typography } from "@mui/material";
import type { AugmentationMode, PromptResponse } from "@hhh/contracts";
import { FormEvent, useState } from "react";
import { submitPrompt } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { PromptForm } from "./PromptForm";
import { PromptResult } from "./PromptResult";

const sessionStorageKey = "hhh.promptSessionId";

export function PromptWorkflowPage() {
  const { getAccessToken } = useAuth();
  const [sessionId] = useState(readSessionId);
  const [prompt, setPrompt] = useState("");
  const [augmentationMode, setAugmentationMode] = useState<AugmentationMode>("auto");
  const [result, setResult] = useState<PromptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const accessToken = await getAccessToken();
      const response = await submitPrompt({ prompt, augmentationMode, sessionId }, accessToken);
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prompt submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box sx={{ py: { xs: 3, md: 6 } }}>
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
              Prompt Workflow
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Ask Claude a question. The API logs every prompt, response, cache decision, and retrieval step.
            </Typography>
          </Box>
          <PromptForm
            prompt={prompt}
            augmentationMode={augmentationMode}
            isSubmitting={isSubmitting}
            onPromptChange={setPrompt}
            onAugmentationModeChange={setAugmentationMode}
            onSubmit={onSubmit}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {result ? <PromptResult result={result} /> : null}
        </Stack>
      </Container>
    </Box>
  );
}

function readSessionId() {
  const existing = window.sessionStorage.getItem(sessionStorageKey);
  if (existing) {
    return existing;
  }

  const next =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.sessionStorage.setItem(sessionStorageKey, next);
  return next;
}
