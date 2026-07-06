import SendIcon from "@mui/icons-material/Send";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { Box, Button, CircularProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { AugmentationMode } from "@hhh/contracts";
import type { FormEvent } from "react";

interface PromptFormProps {
  prompt: string;
  augmentationMode: AugmentationMode;
  isSubmitting: boolean;
  onPromptChange: (value: string) => void;
  onAugmentationModeChange: (value: AugmentationMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function PromptForm({
  prompt,
  augmentationMode,
  isSubmitting,
  onPromptChange,
  onAugmentationModeChange,
  onSubmit
}: PromptFormProps) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: "1px solid", borderColor: "divider" }}>
      <Box component="form" onSubmit={onSubmit}>
        <Stack spacing={2}>
          <TextField
            label="Prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
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
                onAugmentationModeChange(value);
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
  );
}
