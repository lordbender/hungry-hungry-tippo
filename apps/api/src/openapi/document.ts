export function createOpenApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Hungry Hungry Tippo API",
      version: "0.1.0",
      description:
        "Prompt workflow, usage reporting, and organization invoice APIs for Hungry Hungry Tippo."
    },
    servers: [
      {
        url: baseUrl,
        description: "Current API host"
      }
    ],
    tags: [
      { name: "Health" },
      { name: "Prompts" },
      { name: "Admin Reporting" },
      { name: "Invoices" }
    ],
    paths: {
      "/health": {
        get: {
          tags: ["Health"],
          summary: "Check API and database health",
          responses: {
            "200": {
              description: "The API can reach its database.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["status"],
                    properties: {
                      status: { type: "string", enum: ["ok"] }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/prompts": {
        post: {
          tags: ["Prompts"],
          summary: "Submit a prompt",
          description:
            "Runs the prompt workflow, logs request usage, and records organization/user/session context.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PromptRequest" }
              }
            }
          },
          responses: {
            "201": {
              description: "Prompt completed successfully.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PromptResponse" }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/Forbidden" },
            "503": { $ref: "#/components/responses/ClaudeUnavailable" }
          }
        }
      },
      "/api/admin/organizations": {
        get: {
          tags: ["Admin Reporting"],
          summary: "List organizations",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Organizations available to report on.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrganizationListResponse" }
                }
              }
            },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" }
          }
        }
      },
      "/api/admin/reports/overview": {
        get: {
          tags: ["Admin Reporting"],
          summary: "Get organization usage overview",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/FromDate" },
            { $ref: "#/components/parameters/ToDate" }
          ],
          responses: {
            "200": {
              description: "Usage totals grouped by organization.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/AdminOverviewResponse" }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" }
          }
        }
      },
      "/api/admin/reports/organizations/{organizationId}": {
        get: {
          tags: ["Admin Reporting"],
          summary: "Get organization usage drilldown",
          security: [{ bearerAuth: [] }],
          parameters: [
            { $ref: "#/components/parameters/OrganizationId" },
            { $ref: "#/components/parameters/FromDate" },
            { $ref: "#/components/parameters/ToDate" }
          ],
          responses: {
            "200": {
              description: "Usage totals by user, session, and query for one organization.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrganizationUsageResponse" }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" },
            "404": { $ref: "#/components/responses/NotFound" }
          }
        }
      },
      "/api/admin/invoices": {
        get: {
          tags: ["Invoices"],
          summary: "List invoices",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Recent invoices.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/InvoiceListResponse" }
                }
              }
            },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" }
          }
        },
        post: {
          tags: ["Invoices"],
          summary: "Create an invoice for an organization and period",
          description:
            "Snapshots request and token usage into a draft invoice. Amounts are currently zero-rated placeholders.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateInvoiceRequest" }
              }
            }
          },
          responses: {
            "201": {
              description: "Invoice created.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Invoice" }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" }
          }
        }
      },
      "/api/admin/invoices/{invoiceId}/report.pdf": {
        get: {
          tags: ["Invoices"],
          summary: "Download an invoice PDF report",
          description:
            "Generates and stores the invoice PDF on first request, then returns the stored PDF for repeatable downloads.",
          security: [{ bearerAuth: [] }],
          parameters: [{ $ref: "#/components/parameters/InvoiceId" }],
          responses: {
            "200": {
              description: "Stored invoice PDF report.",
              content: {
                "application/pdf": {
                  schema: {
                    type: "string",
                    format: "binary"
                  }
                }
              }
            },
            "400": { $ref: "#/components/responses/ValidationError" },
            "401": { $ref: "#/components/responses/Unauthenticated" },
            "403": { $ref: "#/components/responses/AdminRequired" },
            "404": { $ref: "#/components/responses/NotFound" }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      parameters: {
        FromDate: {
          name: "from",
          in: "query",
          required: true,
          schema: { type: "string", format: "date-time" },
          example: "2026-07-01T00:00:00.000Z"
        },
        ToDate: {
          name: "to",
          in: "query",
          required: true,
          schema: { type: "string", format: "date-time" },
          example: "2026-08-01T00:00:00.000Z"
        },
        OrganizationId: {
          name: "organizationId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" }
        },
        InvoiceId: {
          name: "invoiceId",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" }
        }
      },
      responses: {
        ValidationError: {
          description: "The request did not pass validation.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        },
        Unauthenticated: {
          description: "A valid bearer token is required.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        },
        Forbidden: {
          description: "The token is not allowed to access this resource.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        },
        AdminRequired: {
          description: "The tippo-admin role is required.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        },
        NotFound: {
          description: "The requested resource was not found.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        },
        ClaudeUnavailable: {
          description: "Claude is not configured or unavailable.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiErrorResponse" }
            }
          }
        }
      },
      schemas: {
        ApiErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              }
            }
          }
        },
        PromptRequest: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              minLength: 1,
              maxLength: 12000
            },
            augmentationMode: {
              type: "string",
              enum: ["auto", "direct", "web_search"],
              default: "auto"
            },
            sessionId: {
              type: "string",
              minLength: 1,
              maxLength: 128
            }
          }
        },
        PromptResponse: {
          type: "object",
          required: ["promptLogId", "model", "response", "workflow", "usage"],
          properties: {
            promptLogId: { type: "string", format: "uuid" },
            model: { type: "string" },
            response: { type: "string" },
            workflow: { $ref: "#/components/schemas/WorkflowSummary" },
            usage: { $ref: "#/components/schemas/TokenUsage" }
          }
        },
        WorkflowSummary: {
          type: "object",
          required: [
            "requestedMode",
            "appliedMode",
            "webSearchRequests",
            "localCacheHit",
            "citations",
            "rationale"
          ],
          properties: {
            requestedMode: { type: "string", enum: ["auto", "direct", "web_search"] },
            appliedMode: { type: "string", enum: ["direct", "web_search"] },
            webSearchRequests: { type: "integer", minimum: 0 },
            localCacheHit: { type: "boolean" },
            citations: {
              type: "array",
              items: { $ref: "#/components/schemas/Citation" }
            },
            rationale: { type: "string" }
          }
        },
        Citation: {
          type: "object",
          required: ["title", "url", "citedText"],
          properties: {
            title: { type: ["string", "null"] },
            url: { type: "string", format: "uri" },
            citedText: { type: ["string", "null"] }
          }
        },
        TokenUsage: {
          type: "object",
          required: [
            "inputTokens",
            "cacheCreationInputTokens",
            "cacheReadInputTokens",
            "outputTokens"
          ],
          properties: {
            inputTokens: { type: ["integer", "null"], minimum: 0 },
            cacheCreationInputTokens: { type: ["integer", "null"], minimum: 0 },
            cacheReadInputTokens: { type: ["integer", "null"], minimum: 0 },
            outputTokens: { type: ["integer", "null"], minimum: 0 }
          }
        },
        Organization: {
          type: "object",
          required: ["id", "name", "slug", "billingEmail", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            slug: { type: "string" },
            billingEmail: { type: ["string", "null"], format: "email" },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        OrganizationListResponse: {
          type: "object",
          required: ["organizations"],
          properties: {
            organizations: {
              type: "array",
              items: { $ref: "#/components/schemas/Organization" }
            }
          }
        },
        UsageSummary: {
          type: "object",
          required: [
            "requestCount",
            "succeededRequestCount",
            "failedRequestCount",
            "inputTokens",
            "cacheCreationInputTokens",
            "cacheReadInputTokens",
            "outputTokens",
            "totalTokens"
          ],
          properties: {
            requestCount: { type: "integer", minimum: 0 },
            succeededRequestCount: { type: "integer", minimum: 0 },
            failedRequestCount: { type: "integer", minimum: 0 },
            inputTokens: { type: "integer", minimum: 0 },
            cacheCreationInputTokens: { type: "integer", minimum: 0 },
            cacheReadInputTokens: { type: "integer", minimum: 0 },
            outputTokens: { type: "integer", minimum: 0 },
            totalTokens: { type: "integer", minimum: 0 }
          }
        },
        OrganizationUsageSummary: {
          allOf: [
            { $ref: "#/components/schemas/UsageSummary" },
            {
              type: "object",
              required: ["organizationId", "organizationName", "billingEmail"],
              properties: {
                organizationId: { type: "string", format: "uuid" },
                organizationName: { type: "string" },
                billingEmail: { type: ["string", "null"], format: "email" }
              }
            }
          ]
        },
        UserUsageSummary: {
          allOf: [
            { $ref: "#/components/schemas/UsageSummary" },
            {
              type: "object",
              required: ["userId", "username", "email"],
              properties: {
                userId: { type: "string", format: "uuid" },
                username: { type: "string" },
                email: { type: ["string", "null"], format: "email" }
              }
            }
          ]
        },
        SessionUsageSummary: {
          allOf: [
            { $ref: "#/components/schemas/UsageSummary" },
            {
              type: "object",
              required: ["sessionId", "clientSessionId", "username", "startedAt", "lastSeenAt"],
              properties: {
                sessionId: { type: "string", format: "uuid" },
                clientSessionId: { type: "string" },
                username: { type: "string" },
                startedAt: { type: "string", format: "date-time" },
                lastSeenAt: { type: "string", format: "date-time" }
              }
            }
          ]
        },
        PromptUsageRecord: {
          type: "object",
          required: [
            "promptLogId",
            "userId",
            "username",
            "sessionId",
            "clientSessionId",
            "promptPreview",
            "model",
            "status",
            "inputTokens",
            "cacheCreationInputTokens",
            "cacheReadInputTokens",
            "outputTokens",
            "totalTokens",
            "createdAt"
          ],
          properties: {
            promptLogId: { type: "string", format: "uuid" },
            userId: { type: ["string", "null"], format: "uuid" },
            username: { type: ["string", "null"] },
            sessionId: { type: ["string", "null"], format: "uuid" },
            clientSessionId: { type: ["string", "null"] },
            promptPreview: { type: "string" },
            model: { type: "string" },
            status: { type: "string", enum: ["pending", "succeeded", "failed"] },
            inputTokens: { type: "integer", minimum: 0 },
            cacheCreationInputTokens: { type: "integer", minimum: 0 },
            cacheReadInputTokens: { type: "integer", minimum: 0 },
            outputTokens: { type: "integer", minimum: 0 },
            totalTokens: { type: "integer", minimum: 0 },
            createdAt: { type: "string", format: "date-time" }
          }
        },
        AdminOverviewResponse: {
          type: "object",
          required: ["periodStart", "periodEnd", "organizations", "totals"],
          properties: {
            periodStart: { type: "string", format: "date-time" },
            periodEnd: { type: "string", format: "date-time" },
            organizations: {
              type: "array",
              items: { $ref: "#/components/schemas/OrganizationUsageSummary" }
            },
            totals: { $ref: "#/components/schemas/UsageSummary" }
          }
        },
        OrganizationUsageResponse: {
          type: "object",
          required: ["organization", "periodStart", "periodEnd", "totals", "users", "sessions", "prompts"],
          properties: {
            organization: { $ref: "#/components/schemas/Organization" },
            periodStart: { type: "string", format: "date-time" },
            periodEnd: { type: "string", format: "date-time" },
            totals: { $ref: "#/components/schemas/UsageSummary" },
            users: {
              type: "array",
              items: { $ref: "#/components/schemas/UserUsageSummary" }
            },
            sessions: {
              type: "array",
              items: { $ref: "#/components/schemas/SessionUsageSummary" }
            },
            prompts: {
              type: "array",
              items: { $ref: "#/components/schemas/PromptUsageRecord" }
            }
          }
        },
        CreateInvoiceRequest: {
          type: "object",
          required: ["organizationId", "periodStart", "periodEnd"],
          properties: {
            organizationId: { type: "string", format: "uuid" },
            periodStart: { type: "string", format: "date-time" },
            periodEnd: { type: "string", format: "date-time" }
          }
        },
        Invoice: {
          type: "object",
          required: [
            "id",
            "invoiceNumber",
            "organizationId",
            "organizationName",
            "periodStart",
            "periodEnd",
            "status",
            "requestCount",
            "failedRequestCount",
            "subtotalTokens",
            "amountCents",
            "createdAt",
            "reportGeneratedAt",
            "lineItems"
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            invoiceNumber: { type: "string" },
            organizationId: { type: "string", format: "uuid" },
            organizationName: { type: "string" },
            periodStart: { type: "string", format: "date-time" },
            periodEnd: { type: "string", format: "date-time" },
            status: { type: "string", enum: ["draft", "finalized", "void"] },
            requestCount: { type: "integer", minimum: 0 },
            failedRequestCount: { type: "integer", minimum: 0 },
            subtotalTokens: { type: "integer", minimum: 0 },
            amountCents: { type: "integer", minimum: 0 },
            createdAt: { type: "string", format: "date-time" },
            reportGeneratedAt: { type: ["string", "null"], format: "date-time" },
            lineItems: {
              type: "array",
              items: { $ref: "#/components/schemas/InvoiceLineItem" }
            }
          }
        },
        InvoiceLineItem: {
          type: "object",
          required: [
            "id",
            "description",
            "requestCount",
            "inputTokens",
            "cacheCreationInputTokens",
            "cacheReadInputTokens",
            "outputTokens",
            "totalTokens",
            "amountCents"
          ],
          properties: {
            id: { type: "string", format: "uuid" },
            description: { type: "string" },
            requestCount: { type: "integer", minimum: 0 },
            inputTokens: { type: "integer", minimum: 0 },
            cacheCreationInputTokens: { type: "integer", minimum: 0 },
            cacheReadInputTokens: { type: "integer", minimum: 0 },
            outputTokens: { type: "integer", minimum: 0 },
            totalTokens: { type: "integer", minimum: 0 },
            amountCents: { type: "integer", minimum: 0 }
          }
        },
        InvoiceListResponse: {
          type: "object",
          required: ["invoices"],
          properties: {
            invoices: {
              type: "array",
              items: { $ref: "#/components/schemas/Invoice" }
            }
          }
        }
      }
    }
  };
}
