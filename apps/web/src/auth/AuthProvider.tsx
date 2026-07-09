import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { keycloak } from "./keycloak";

export interface AuthUser {
  subject: string;
  username: string;
  email?: string;
  name?: string;
  roles: string[];
}

interface AuthContextValue {
  initialized: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasInitialized = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const syncAuthState = useCallback(() => {
    setAuthenticated(Boolean(keycloak.authenticated));
    setUser(readUser());
  }, []);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;
    keycloak
      .init({
        onLoad: "check-sso",
        pkceMethod: "S256",
        checkLoginIframe: false
      })
      .then(() => {
        syncAuthState();
        setInitialized(true);
      })
      .catch(() => {
        setInitialized(true);
      });

    keycloak.onAuthSuccess = syncAuthState;
    keycloak.onAuthRefreshSuccess = syncAuthState;
    keycloak.onAuthLogout = syncAuthState;
  }, [syncAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      authenticated,
      user,
      login: () => keycloak.login(),
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
      getAccessToken: async () => {
        await keycloak.updateToken(30);
        if (!keycloak.token) {
          throw new Error("Authentication token is not available.");
        }
        return keycloak.token;
      }
    }),
    [authenticated, initialized, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

function readUser(): AuthUser | null {
  const token = keycloak.tokenParsed;
  if (!token?.sub) {
    return null;
  }

  return {
    subject: token.sub,
    username: token.preferred_username ?? token.email ?? token.sub,
    email: token.email,
    name: token.name,
    roles: readRoles(token.realm_access)
  };
}

function readRoles(realmAccess: unknown) {
  if (!realmAccess || typeof realmAccess !== "object" || !("roles" in realmAccess)) {
    return [];
  }

  const roles = realmAccess.roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}
