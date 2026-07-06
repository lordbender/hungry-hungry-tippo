import { createTheme } from "@mui/material";

export const theme = createTheme({
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
