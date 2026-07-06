import { CircularProgress, Container, Stack, Typography } from "@mui/material";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { AppShell } from "./layout/AppShell";
import { PromptWorkflowPage } from "./prompt/PromptWorkflowPage";

export function App() {
  return (
    <AuthProvider>
      <AppShell>
        <AuthenticatedApp />
      </AppShell>
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { initialized, authenticated } = useAuth();

  if (!initialized) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Preparing authentication...</Typography>
        </Stack>
      </Container>
    );
  }

  return authenticated ? <PromptWorkflowPage /> : <LoginScreen />;
}
