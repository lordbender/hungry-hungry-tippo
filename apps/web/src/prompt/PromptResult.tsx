import { Box, Chip, Link, Paper, Stack, Typography } from "@mui/material";
import type { PromptResponse } from "@hhh/contracts";

export function PromptResult({ result }: { result: PromptResponse }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider" }}>
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
          <Chip label={`Searches ${result.workflow.webSearchRequests}`} size="small" variant="outlined" />
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
  );
}
