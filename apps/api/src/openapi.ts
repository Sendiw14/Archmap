/** OpenAPI 3.1 document generated from the zod contract. `node apps/api/src/openapi.ts > docs/api/openapi.json` */
import { z } from "zod";
import {
  AnalysisSummary,
  ApiError,
  CreateAnalysisRequest,
  CreateAnalysisResponse,
  HealthResponse,
  managementCookieName,
} from "@archmap/contracts";
import { ArchmapGraph, Finding } from "@archmap/graph-schema";

const schema = (s: z.ZodType) =>
  z.toJSONSchema(s, { target: "draft-2020-12", unrepresentable: "any" });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ "application/json": { schema: ref(name) } });
const err = (description: string) => ({ description, content: json("ApiError") });
const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const readErrors = {
  "404": err("Unknown analysis (`not_found`)"),
  "410": err("Analysis expired; results deleted (`expired`)"),
};
const mgmtCookie = managementCookieName("{id}");

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "ARCHMAP hosted API",
      version: "1.0.0",
      description:
        "Analyze public GitHub repositories. Edges point from the importing module to the imported module. Results expire after the retention period. Cancel/delete require the per-analysis HttpOnly management cookie issued to the creator; state-changing requests must be same-origin.",
    },
    servers: [{ url: "/" }],
    components: {
      schemas: {
        CreateAnalysisRequest: schema(CreateAnalysisRequest),
        CreateAnalysisResponse: schema(CreateAnalysisResponse),
        AnalysisSummary: schema(AnalysisSummary),
        ApiError: schema(ApiError),
        Graph: schema(ArchmapGraph),
        FindingsResponse: schema(z.object({ findings: z.array(Finding) })),
        Health: schema(HealthResponse),
      },
      securitySchemes: {
        management: {
          type: "apiKey",
          in: "cookie",
          name: mgmtCookie,
          description:
            "256-bit per-analysis capability; HttpOnly, SameSite=Strict, path-scoped to the analysis.",
        },
      },
    },
    paths: {
      "/v1/analyses": {
        post: {
          summary: "Submit a public GitHub repository for analysis",
          requestBody: { required: true, content: json("CreateAnalysisRequest") },
          responses: {
            "202": {
              description: "Queued; sets the management cookie",
              content: json("CreateAnalysisResponse"),
            },
            "200": {
              description: "Existing result for the same commit reused (no management cookie)",
              content: json("CreateAnalysisResponse"),
            },
            "400": err("`invalid_request`, `invalid_repository`, `unsupported_provider`"),
            "401": err("Cross-origin request (`unauthorized`)"),
            "403": err("`repository_not_public`"),
            "404": err("`repository_not_found`, `ref_not_found`"),
            "429": err("`rate_limited` (see Retry-After)"),
            "503": err("`github_unavailable`, `imports_disabled`, `queue_full`"),
          },
        },
      },
      "/v1/analyses/{id}": {
        get: {
          summary: "Analysis status",
          parameters: [idParam],
          responses: {
            "200": { description: "Status", content: json("AnalysisSummary") },
            ...readErrors,
          },
        },
        delete: {
          summary: "Delete an analysis and its results",
          parameters: [idParam],
          security: [{ management: [] }],
          responses: {
            "204": { description: "Deleted" },
            "401": err("Missing/invalid management capability"),
            ...readErrors,
          },
        },
      },
      "/v1/analyses/{id}/graph": {
        get: {
          summary: "Normalized graph (schema 1.x)",
          parameters: [idParam],
          responses: {
            "200": { description: "Graph", content: json("Graph") },
            "409": err("`not_ready`"),
            ...readErrors,
          },
        },
      },
      "/v1/analyses/{id}/findings": {
        get: {
          summary: "Findings",
          parameters: [idParam],
          responses: {
            "200": { description: "Findings", content: json("FindingsResponse") },
            "409": err("`not_ready`"),
            ...readErrors,
          },
        },
      },
      "/v1/analyses/{id}/report": {
        get: {
          summary: "Downloadable report",
          parameters: [
            idParam,
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["markdown", "json"], default: "markdown" },
            },
          ],
          responses: {
            "200": {
              description: "Report attachment",
              content: {
                "text/markdown": { schema: { type: "string" } },
                "application/json": { schema: ref("Graph") },
              },
            },
            "400": err("Unknown format"),
            "409": err("`not_ready`"),
            ...readErrors,
          },
        },
      },
      "/v1/analyses/{id}/cancel": {
        post: {
          summary: "Cancel a queued or running analysis",
          parameters: [idParam],
          security: [{ management: [] }],
          responses: {
            "202": { description: "Cancelled", content: json("AnalysisSummary") },
            "401": err("Missing/invalid management capability"),
            "409": err("Already finished (`conflict`)"),
            ...readErrors,
          },
        },
      },
      "/health/live": {
        get: {
          summary: "Liveness",
          responses: { "200": { description: "Process is up", content: json("Health") } },
        },
      },
      "/health/ready": {
        get: {
          summary: "Readiness (store, queue, artifacts)",
          responses: {
            "200": { description: "Ready", content: json("Health") },
            "503": { description: "Dependency failing", content: json("Health") },
          },
        },
      },
    },
  };
}

if (import.meta.main) process.stdout.write(`${JSON.stringify(openApiDocument(), null, 2)}\n`);
