import { createHttpServer } from "./config/http.js";
import { env } from "./config/env.js";
import { runMigrations } from "./database/migrate.js";

async function main() {
  await runMigrations();

  const app = createHttpServer();
  app.listen(env.API_PORT, () => {
    console.log(`API listening on http://localhost:${env.API_PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
