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
