import { Box, CssBaseline, ThemeProvider } from "@mui/material";
import { ReactNode } from "react";
import { HeaderNav } from "./HeaderNav";
import { theme } from "../theme";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <HeaderNav />
        {children}
      </Box>
    </ThemeProvider>
  );
}
