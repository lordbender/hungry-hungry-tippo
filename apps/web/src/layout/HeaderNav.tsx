import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ChatIcon from "@mui/icons-material/Chat";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { AppBar, Box, Button, Chip, Container, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthProvider";

export type AppPage = "prompt" | "admin";

export function HeaderNav({
  activePage,
  onNavigate
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}) {
  const { authenticated, user, login, logout } = useAuth();
  const isAdmin = user?.roles.includes("tippo-admin") ?? false;

  return (
    <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ gap: 2, minHeight: 64 }}>
          <SmartToyIcon color="primary" />
          <Typography component="div" sx={{ fontWeight: 700, flex: 1 }}>
            Hungry Hungry Tippo
          </Typography>
          {authenticated ? (
            <Button
              color={activePage === "prompt" ? "primary" : "inherit"}
              startIcon={<ChatIcon />}
              onClick={() => onNavigate("prompt")}
            >
              Prompt
            </Button>
          ) : null}
          {authenticated && isAdmin ? (
            <Button
              color={activePage === "admin" ? "primary" : "inherit"}
              startIcon={<AssessmentIcon />}
              onClick={() => onNavigate("admin")}
            >
              Admin
            </Button>
          ) : null}
          {authenticated && user ? <Chip label={user.username} size="small" variant="outlined" /> : null}
          <Tooltip title={authenticated ? "Profile" : "Not signed in"}>
            <IconButton aria-label="Profile">
              <AccountCircleIcon />
            </IconButton>
          </Tooltip>
          <Box>
            {authenticated ? (
              <Button startIcon={<LogoutIcon />} onClick={() => void logout()}>
                Logout
              </Button>
            ) : (
              <Button startIcon={<LoginIcon />} variant="contained" onClick={() => void login()}>
                Login
              </Button>
            )}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
