import { CircularProgress, Container, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { AdminReportingPage } from "./admin/AdminReportingPage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { AppShell } from "./layout/AppShell";
import type { AppPage } from "./layout/HeaderNav";
import { PromptWorkflowPage } from "./prompt/PromptWorkflowPage";

export function App() {
  const [activePage, setActivePage] = useState<AppPage>("prompt");

  return (
    <AuthProvider>
      <AppShell activePage={activePage} onNavigate={setActivePage}>
        <AuthenticatedApp activePage={activePage} onNavigate={setActivePage} />
      </AppShell>
    </AuthProvider>
  );
}

function AuthenticatedApp({
  activePage
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}) {
  const { initialized, authenticated, user } = useAuth();

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

  if (!authenticated) {
    return <LoginScreen />;
  }

  if (activePage === "admin" && user?.roles.includes("tippo-admin")) {
    return <AdminReportingPage />;
  }

  return <PromptWorkflowPage />;
}
