import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!env.KEYCLOAK_AUTH_ENABLED) {
    next();
    return;
  }

  if (req.auth?.roles.includes("tippo-admin")) {
    next();
    return;
  }

  res.status(403).json({
    error: {
      code: "ADMIN_REQUIRED",
      message: "An administrator role is required."
    }
  });
}
