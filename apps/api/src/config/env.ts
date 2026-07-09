import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(dirname, "../../../../.env");

dotenv.config({ path: rootEnvPath });

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CLAUDE_MAX_TOKENS: z.coerce.number().int().positive().default(1024),
  CLAUDE_MODEL: z.string().min(1).default("claude-opus-4-8"),
  CLAUDE_PROMPT_CACHE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  LOCAL_RESPONSE_CACHE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  LOCAL_RESPONSE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  BILLING_COST_PER_CREDIT_USD: z.coerce.number().nonnegative().default(0.000001),
  BILLING_CREDIT_MARKUP_RATE: z.coerce.number().nonnegative().default(0.5),
  KEYCLOAK_AUTH_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  KEYCLOAK_CLIENT_ID: z.string().min(1).default("hungry-hungry-tippo-web"),
  KEYCLOAK_ISSUER: z.string().url().default("http://localhost:8081/realms/hungry-hungry-tippo"),
  KEYCLOAK_JWKS_URI: z
    .string()
    .url()
    .default("http://localhost:8081/realms/hungry-hungry-tippo/protocol/openid-connect/certs"),
  CLAUDE_WEB_SEARCH_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  CLAUDE_WEB_SEARCH_MAX_USES: z.coerce.number().int().min(1).max(10).default(3),
  DATABASE_URL: z.string().url().default("postgres://tippo:tippo@localhost:5432/tippo"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WEB_ORIGIN: z.string().url().optional()
});

export const env = EnvSchema.parse(process.env);
