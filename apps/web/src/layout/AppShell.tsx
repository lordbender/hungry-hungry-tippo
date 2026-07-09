import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode } from "react";
import { HeaderNav, type AppPage } from "./HeaderNav";
import { theme } from "../theme";

export function AppShell({
  activePage,
  children,
  onNavigate
}: {
  activePage: AppPage;
  children: ReactNode;
  onNavigate: (page: AppPage) => void;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <HeaderNav activePage={activePage} onNavigate={onNavigate} />
        {children}
      </Box>
    </ThemeProvider>
  );
}
