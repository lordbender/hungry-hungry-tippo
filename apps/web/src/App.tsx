import SendIcon from "@mui/icons-material/Send";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Link,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  createTheme
} from "@mui/material";
import { FormEvent, useState } from "react";
import type { AugmentationMode, PromptResponse } from "@hhh/contracts";
import { submitPrompt } from "./api/client";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f766e"
    },
    secondary: {
      main: "#7c2d12"
    },
    background: {
      default: "#f7f7f4",
      paper: "#ffffff"
    }
  },
  shape: {
    borderRadius: 8
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  }
});

export function App() {
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
      const response = await submitPrompt({ prompt, augmentationMode });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Prompt submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          py: { xs: 3, md: 6 }
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={3}>
            <Box>
              <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
                Hungry Hungry Tippo
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Ask Claude a question. The API logs every prompt and response for future workflow
                analysis.
              </Typography>
            </Box>

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider" }}>
              <Box component="form" onSubmit={onSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    minRows={6}
                    multiline
                    fullWidth
                    disabled={isSubmitting}
                    placeholder="What should this agentic workflow help with first?"
                  />
                  <ToggleButtonGroup
                    value={augmentationMode}
                    exclusive
                    size="small"
                    onChange={(_event, value: AugmentationMode | null) => {
                      if (value) {
                        setAugmentationMode(value);
                      }
                    }}
                    disabled={isSubmitting}
                    aria-label="Augmentation mode"
                  >
                    <ToggleButton value="auto" aria-label="Auto mode">
                      Auto
                    </ToggleButton>
                    <ToggleButton value="web_search" aria-label="Web search mode">
                      <TravelExploreIcon fontSize="small" sx={{ mr: 0.75 }} />
                      Web
                    </ToggleButton>
                    <ToggleButton value="direct" aria-label="Direct mode">
                      Direct
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      type="submit"
                      variant="contained"
                      endIcon={isSubmitting ? <CircularProgress color="inherit" size={18} /> : <SendIcon />}
                      disabled={isSubmitting || !prompt.trim()}
                    >
                      Send
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Paper>

            {error ? <Alert severity="error">{error}</Alert> : null}

            {result ? (
              <Paper
                elevation={0}
                sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip label={result.model} size="small" />
                    <Chip label={`Mode ${result.workflow.appliedMode}`} size="small" />
                    <Chip
                      label={result.workflow.localCacheHit ? "Local cache hit" : "Local cache miss"}
                      size="small"
                      color={result.workflow.localCacheHit ? "success" : "default"}
                      variant={result.workflow.localCacheHit ? "filled" : "outlined"}
                    />
                    <Chip
                      label={`Searches ${result.workflow.webSearchRequests}`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip label={`Log ${result.promptLogId}`} size="small" variant="outlined" />
                    <Chip
                      label={`Tokens ${result.usage.inputTokens ?? "?"}/${result.usage.outputTokens ?? "?"}`}
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`Claude cache ${result.usage.cacheCreationInputTokens ?? 0}/${result.usage.cacheReadInputTokens ?? 0}`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography component="pre" sx={{ whiteSpace: "pre-wrap", m: 0, fontFamily: "inherit" }}>
                    {result.response}
                  </Typography>
                  <Typography color="text.secondary" variant="body2">
                    {result.workflow.rationale}
                  </Typography>
                  {result.workflow.citations.length > 0 ? (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Sources</Typography>
                      {result.workflow.citations.map((citation) => (
                        <Box key={`${citation.url}:${citation.citedText ?? ""}`}>
                          <Link href={citation.url} target="_blank" rel="noreferrer">
                            {citation.title ?? citation.url}
                          </Link>
                          {citation.citedText ? (
                            <Typography color="text.secondary" variant="body2">
                              {citation.citedText}
                            </Typography>
                          ) : null}
                        </Box>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
