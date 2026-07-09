import type { NextFunction, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(env.KEYCLOAK_JWKS_URI));

declare global {
  namespace Express {
    interface Request {
      auth?: {
        subject: string;
        username?: string;
        email?: string;
        roles: string[];
        organizationName?: string;
        organizationSlug?: string;
        billingEmail?: string;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!env.KEYCLOAK_AUTH_ENABLED) {
    next();
    return;
  }

  const authorization = req.header("authorization");
  const token = authorization?.match(/^Bearer (.+)$/i)?.[1];

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "A bearer token is required."
      }
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.KEYCLOAK_ISSUER
    });

    const authorizedParty = typeof payload.azp === "string" ? payload.azp : undefined;
    const audience = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];

    if (authorizedParty !== env.KEYCLOAK_CLIENT_ID && !audience.includes(env.KEYCLOAK_CLIENT_ID)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "The token was not issued for this application."
        }
      });
      return;
    }

    const realmAccess = payload.realm_access as { roles?: string[] } | undefined;

    req.auth = {
      subject: payload.sub ?? "",
      username: typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      roles: realmAccess?.roles ?? [],
      organizationName: stringClaim(payload, ["organization_name", "organization", "org_name", "org"]),
      organizationSlug: stringClaim(payload, ["organization_slug", "organization_id", "org_id"]),
      billingEmail: stringClaim(payload, ["billing_email"])
    };

    next();
  } catch {
    res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "The bearer token is invalid or expired."
      }
    });
  }
}

function stringClaim(payload: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}
