import { describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@archmap/contracts";
import { createApiClient } from "./client";
import { ApiClientError, ERROR_COPY, codeFromStatus, copyForError } from "./errors";
import circular from "../../demo-data/circular.json";

const ID = "3f2b8d3e-7f0a-4a52-9c1f-0e5f2f0d6a11";
const summary = {
  id: ID,
  repository: { owner: "o", repo: "r", url: "https://github.com/o/r" },
  ref: null,
  commit: "a".repeat(40),
  status: "queued",
  error: null,
  analyzerVersion: "0.1.0",
  schemaVersion: "1.0.0",
  stats: null,
  createdAt: "2026-11-21T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  expiresAt: "2026-11-22T10:00:00.000Z",
};

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

function clientWith(fn: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(fn);
  return { spy, api: createApiClient({ fetch: spy as unknown as typeof fetch }) };
}

describe("api client: requests", () => {
  it("POSTs JSON to /v1/analyses and validates the response", async () => {
    const { api, spy } = clientWith(async () =>
      reply(202, { analysis: summary, reused: false, canManage: true }),
    );
    const res = await api.createAnalysis({ repository: "o/r", ref: "main" });
    expect(res.canManage).toBe(true);
    expect(res.analysis.id).toBe(ID);
    const [url, init] = spy.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/v1/analyses");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("same-origin");
    expect(JSON.parse(init?.body as string)).toEqual({ repository: "o/r", ref: "main" });
  });

  it("accepts both a bare summary and a wrapped one for GET /v1/analyses/:id", async () => {
    const a = clientWith(async () => reply(200, summary));
    expect((await a.api.getAnalysis(ID)).status).toBe("queued");
    const b = clientWith(async () => reply(200, { analysis: summary }));
    expect((await b.api.getAnalysis(ID)).id).toBe(ID);
    expect((a.spy.mock.calls[0] as unknown[])[0]).toBe(`/v1/analyses/${ID}`);
  });

  it("validates graphs with the ArchmapGraph schema", async () => {
    const ok = clientWith(async () => reply(200, circular));
    expect((await ok.api.getGraph(ID)).nodes.length).toBe(4);
    const bad = clientWith(async () => reply(200, { nodes: [] }));
    await expect(bad.api.getGraph(ID)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("requests the Markdown report with ?format=markdown", async () => {
    const { api, spy } = clientWith(async () => reply(200, "# ARCHMAP report"));
    expect(await api.getReportMarkdown(ID)).toBe("# ARCHMAP report");
    expect((spy.mock.calls[0] as unknown[])[0]).toBe(`/v1/analyses/${ID}/report?format=markdown`);
  });

  it("uses POST for cancel and DELETE for delete", async () => {
    const { api, spy } = clientWith(async () => new Response(null, { status: 204 }));
    await api.cancelAnalysis(ID);
    await api.deleteAnalysis(ID);
    expect(
      (spy.mock.calls as [string, RequestInit][]).map(([u, i]) => `${i?.method} ${u}`),
    ).toEqual([`POST /v1/analyses/${ID}/cancel`, `DELETE /v1/analyses/${ID}`]);
  });

  it("encodes the id and honours a base URL", async () => {
    const spy = vi.fn(async () => reply(200, summary));
    const api = createApiClient({
      baseUrl: "https://api.test",
      fetch: spy as unknown as typeof fetch,
    });
    await api.getAnalysis("a/b");
    expect((spy.mock.calls[0] as unknown[])[0]).toBe("https://api.test/v1/analyses/a%2Fb");
  });
});

describe("api client: error mapping", () => {
  it("maps a contract error body to its ErrorCode", async () => {
    for (const code of ErrorCode.options) {
      const { api } = clientWith(async () =>
        reply(400, { error: { code, message: `server says ${code}` } }),
      );
      await expect(api.getAnalysis(ID)).rejects.toMatchObject({ kind: "api", code, status: 400 });
    }
  });

  it("falls back to the HTTP status when the body is not an ApiError", async () => {
    const cases: [number, string][] = [
      [400, "invalid_request"],
      [401, "unauthorized"],
      [404, "not_found"],
      [409, "conflict"],
      [410, "expired"],
      [429, "rate_limited"],
      [503, "imports_disabled"],
      [500, "internal"],
      [502, "internal"],
    ];
    for (const [status, code] of cases) {
      const { api } = clientWith(async () => reply(status, "<html>nope</html>"));
      await expect(api.getAnalysis(ID)).rejects.toMatchObject({ code, status });
      expect(codeFromStatus(status)).toBe(code);
    }
  });

  it("reads Retry-After from a 429", async () => {
    const { api } = clientWith(async () =>
      reply(
        429,
        { error: { code: "rate_limited", message: "slow down" } },
        { "retry-after": "1800" },
      ),
    );
    const err = await api.createAnalysis({ repository: "o/r" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).retryAfterSeconds).toBe(1800);
    expect(copyForError(err).message).toContain("30 min");
  });

  it("turns transport failures into network errors and aborts into aborted", async () => {
    const down = clientWith(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(down.api.getAnalysis(ID)).rejects.toMatchObject({ kind: "network" });
    const ctrl = new AbortController();
    ctrl.abort();
    const aborted = clientWith(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(aborted.api.getAnalysis(ID, { signal: ctrl.signal })).rejects.toMatchObject({
      kind: "aborted",
    });
  });

  it("rejects bodies that break the contract", async () => {
    const { api } = clientWith(async () => reply(200, { analysis: { id: "not-a-uuid" } }));
    await expect(api.getAnalysis(ID)).rejects.toMatchObject({ kind: "invalid_response" });
    const html = clientWith(async () => reply(200, "<html></html>"));
    await expect(html.api.getAnalysis(ID)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("health resolves to unavailable when unreachable and reflects the reported status", async () => {
    const down = clientWith(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await down.api.health()).toBe("unavailable");
    const degraded = clientWith(async () => reply(200, { status: "degraded" }));
    expect(await degraded.api.health()).toBe("degraded");
    const err503 = clientWith(async () => reply(503, { status: "unavailable" }));
    expect(await err503.api.health()).toBe("unavailable");
  });
});

describe("error copy", () => {
  it("has a title, message and recovery action for every ErrorCode", () => {
    for (const code of ErrorCode.options) {
      const c = ERROR_COPY[code];
      expect(c.title.length, code).toBeGreaterThan(5);
      expect(c.message.length, code).toBeGreaterThan(20);
      expect(c.actionLabel.length, code).toBeGreaterThan(1);
    }
  });

  it("derives numbers from DEFAULT_LIMITS instead of hard-coding them", () => {
    expect(ERROR_COPY.rate_limited.message).toContain("5 analyses per hour");
    expect(ERROR_COPY.limit_exceeded.message).toContain("10,000");
    expect(ERROR_COPY.expired.message).toContain("24 hours");
  });

  it("classifies transient failures", () => {
    const t = (init: ConstructorParameters<typeof ApiClientError>[0]) =>
      new ApiClientError(init).transient;
    expect(t({ kind: "network", message: "x" })).toBe(true);
    expect(t({ kind: "api", message: "x", code: "internal", status: 500 })).toBe(true);
    expect(t({ kind: "api", message: "x", code: "rate_limited", status: 429 })).toBe(true);
    expect(t({ kind: "api", message: "x", code: "not_found", status: 404 })).toBe(false);
    expect(t({ kind: "invalid_response", message: "x" })).toBe(false);
  });

  it("falls back to generic copy for unknown errors", () => {
    expect(copyForError(new Error("boom"))).toBe(ERROR_COPY.internal);
    expect(copyForError(new ApiClientError({ kind: "network", message: "x" })).title).toContain(
      "Cannot reach",
    );
  });
});
