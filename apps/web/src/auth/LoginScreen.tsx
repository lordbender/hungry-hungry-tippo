import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { initialized, login } = useAuth();

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, border: "1px solid", borderColor: "divider" }}>
        <Stack spacing={3} alignItems="flex-start">
          <Box>
            <LockOutlinedIcon color="primary" />
            <Typography component="h1" variant="h4" sx={{ mt: 1, fontWeight: 700 }}>
              Sign in required
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Prompt workflows are protected by Keycloak. Use a provisioned account to continue.
            </Typography>
          </Box>
          <Button
            disabled={!initialized}
            onClick={() => void login()}
            startIcon={!initialized ? <CircularProgress color="inherit" size={18} /> : undefined}
            variant="contained"
          >
            Login with Keycloak
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
