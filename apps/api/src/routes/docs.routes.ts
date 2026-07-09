import { Router } from "express";
import { createOpenApiDocument } from "../openapi/document.js";

export const docsRouter = Router();

docsRouter.get("/openapi.json", (req, res) => {
  res.json(createOpenApiDocument(`${req.protocol}://${req.get("host")}`));
});

docsRouter.get("/", (_req, res) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https://unpkg.com",
      "font-src 'self' data:",
      "connect-src 'self'"
    ].join("; ")
  );
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hungry Hungry Tippo API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f7f7f4;
      }

      .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true
      });
    </script>
  </body>
</html>`);
});
