import {
  AnalysisSummary,
  ApiError,
  CreateAnalysisResponse,
  HealthResponse,
  type CreateAnalysisRequest,
} from "@archmap/contracts";
import type { ArchmapGraph } from "@archmap/graph-schema";
import { parseGraph } from "../graph/load";
import { ApiClientError, codeFromStatus } from "./errors";

export interface ApiClientOptions {
  /** Empty string = same origin (the Next rewrites proxy /v1 and /health to the API). */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export type HealthStatus = "ok" | "degraded" | "unavailable";

const wrapSummary = (raw: unknown): unknown =>
  raw && typeof raw === "object" && "analysis" in raw
    ? (raw as { analysis: unknown }).analysis
    : raw;

/**
 * Typed client for the hosted API contract (packages/contracts).
 * Every non-2xx response and every transport failure becomes an ApiClientError,
 * and every success body is validated before it reaches the UI.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const base = options.baseUrl ?? "";
  const doFetch = (input: string, init?: RequestInit) =>
    (options.fetch ?? globalThis.fetch.bind(globalThis))(input, init);

  async function send(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, { ...init, signal, credentials: "same-origin" });
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError"))
        throw new ApiClientError({ kind: "aborted", message: "Request aborted" });
      throw new ApiClientError({ kind: "network", message: "Network request failed" });
    }
    if (res.ok) return res;
    let code = codeFromStatus(res.status);
    let message = `HTTP ${res.status}`;
    try {
      const parsed = ApiError.safeParse(await res.json());
      if (parsed.success) {
        code = parsed.data.error.code;
        message = parsed.data.error.message;
      }
    } catch {
      /* non-JSON error body: the status code decides */
    }
    const retry = Number(res.headers.get("retry-after"));
    throw new ApiClientError({
      kind: "api",
      status: res.status,
      code,
      message,
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null,
    });
  }

  async function json(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new ApiClientError({ kind: "invalid_response", message: "Response was not JSON" });
    }
  }

  const invalid = (what: string) =>
    new ApiClientError({ kind: "invalid_response", message: `Invalid ${what} response` });

  return {
    async createAnalysis(req: CreateAnalysisRequest, o: RequestOptions = {}) {
      const res = await send(
        "/v1/analyses",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
        },
        o.signal,
      );
      const parsed = CreateAnalysisResponse.safeParse(await json(res));
      if (!parsed.success) throw invalid("create-analysis");
      return parsed.data;
    },

    async getAnalysis(id: string, o: RequestOptions = {}): Promise<AnalysisSummary> {
      const res = await send(`/v1/analyses/${encodeURIComponent(id)}`, {}, o.signal);
      const parsed = AnalysisSummary.safeParse(wrapSummary(await json(res)));
      if (!parsed.success) throw invalid("analysis");
      return parsed.data;
    },

    async getGraph(id: string, o: RequestOptions = {}): Promise<ArchmapGraph> {
      const res = await send(`/v1/analyses/${encodeURIComponent(id)}/graph`, {}, o.signal);
      const result = parseGraph(await json(res));
      if (!result.ok) throw invalid("graph");
      return result.graph;
    },

    async getReportMarkdown(id: string, o: RequestOptions = {}): Promise<string> {
      const res = await send(
        `/v1/analyses/${encodeURIComponent(id)}/report?format=markdown`,
        {},
        o.signal,
      );
      return res.text();
    },

    /** Cancel. The body, if any, is ignored: the next GET shows the resulting status. */
    async cancelAnalysis(id: string, o: RequestOptions = {}): Promise<void> {
      await send(`/v1/analyses/${encodeURIComponent(id)}/cancel`, { method: "POST" }, o.signal);
    },

    async deleteAnalysis(id: string, o: RequestOptions = {}): Promise<void> {
      await send(`/v1/analyses/${encodeURIComponent(id)}`, { method: "DELETE" }, o.signal);
    },

    /** Readiness. Resolves to "unavailable" on transport failure (the service is not reachable). */
    async health(o: RequestOptions = {}): Promise<HealthStatus> {
      try {
        const res = await send("/health/ready", {}, o.signal);
        const parsed = HealthResponse.safeParse(await json(res));
        return parsed.success ? parsed.data.status : "degraded";
      } catch (e) {
        if (e instanceof ApiClientError && e.kind === "aborted") throw e;
        return "unavailable";
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
export const api: ApiClient = createApiClient();
