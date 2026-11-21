import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { create as tarCreate } from "tar";
import { HostedError, type ResolvedRepository, type SourceProvider } from "./ports.ts";

const API = "https://api.github.com";
const CODELOAD = "https://codeload.github.com";

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw tooLarge(maxBytes);
  if (!res.body) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > maxBytes) throw tooLarge(maxBytes);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

const tooLarge = (max: number) =>
  new HostedError(
    "limit_exceeded",
    `Repository archive exceeds ${Math.round(max / 1024 / 1024)} MiB`,
  );

/**
 * Public GitHub only. Requests go to two fixed hosts; redirects are never followed
 * (spec §7.1: no user-controlled redirects / arbitrary outbound requests).
 */
export class GitHubSource implements SourceProvider {
  private readonly token: string | undefined;
  private readonly fetchImpl: typeof fetch;
  constructor(opts: { token?: string; fetchImpl?: typeof fetch } = {}) {
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async api(pathname: string, accept: string, signal?: AbortSignal) {
    const headers: Record<string, string> = {
      accept,
      "user-agent": "archmap-analyzer",
      "x-github-api-version": "2022-11-28",
    };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}${pathname}`, {
        headers,
        redirect: "manual",
        signal: signal ?? AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HostedError("github_unavailable", "GitHub could not be reached", true);
    }
    if (
      (res.status === 403 || res.status === 429) &&
      res.headers.get("x-ratelimit-remaining") === "0"
    )
      throw new HostedError(
        "github_unavailable",
        "GitHub rate limit reached; try again later",
        true,
      );
    if (res.status >= 500)
      throw new HostedError("github_unavailable", "GitHub is unavailable", true);
    return res;
  }

  async resolve(owner: string, repo: string, ref: string | undefined): Promise<ResolvedRepository> {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const meta = await this.api(base, "application/vnd.github+json");
    if (meta.status === 404 || (meta.status >= 300 && meta.status < 400))
      throw new HostedError("repository_not_found", "Repository not found (or not public)");
    if (meta.status !== 200)
      throw new HostedError("github_unavailable", `GitHub returned ${meta.status}`, true);
    const info = (await meta.json()) as {
      private?: boolean;
      visibility?: string;
      default_branch?: string;
      size?: number;
      owner?: { login?: string };
      name?: string;
    };
    if (info.private || (info.visibility && info.visibility !== "public"))
      throw new HostedError("repository_not_public", "Only public repositories can be analyzed");
    const wanted = ref ?? info.default_branch;
    if (!wanted) throw new HostedError("ref_not_found", "Repository has no default branch");
    const c = await this.api(
      `${base}/commits/${encodeURIComponent(wanted)}`,
      "application/vnd.github.sha",
    );
    if (c.status === 404 || c.status === 422)
      throw new HostedError("ref_not_found", `Ref "${wanted}" not found`);
    if (c.status !== 200)
      throw new HostedError("github_unavailable", `GitHub returned ${c.status}`, true);
    const commit = (await c.text()).trim();
    if (!/^[0-9a-f]{40}$/.test(commit))
      throw new HostedError("github_unavailable", "Unexpected commit response", true);
    return {
      owner: info.owner?.login ?? owner,
      repo: info.name ?? repo,
      commit,
      ref: ref ?? null,
      sizeKb: info.size ?? 0,
    };
  }

  async download(r: ResolvedRepository, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
    const url = `${CODELOAD}/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/tar.gz/${r.commit}`;
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        headers: { "user-agent": "archmap-analyzer" },
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw new HostedError("github_unavailable", "Archive download failed", true);
    }
    if (res.status === 404) throw new HostedError("repository_not_found", "Archive not found");
    if (res.status !== 200)
      throw new HostedError("github_unavailable", `Archive download returned ${res.status}`, true);
    return readCapped(res, maxBytes);
  }
}

export const FIXTURE_OWNER = "archmap-fixtures";

/**
 * Offline provider: `archmap-fixtures/<dir>` serves a local fixture directory as a tarball
 * through the same extraction + analysis pipeline. The "commit" is a content hash, not a git SHA.
 */
export class FixtureSource implements SourceProvider {
  private readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private dirs() {
    return fs
      .readdirSync(this.root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  private contentHash(name: string) {
    const h = createHash("sha1");
    const walk = (rel: string) => {
      for (const e of fs
        .readdirSync(path.join(this.root, rel), { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) walk(p);
        else if (e.isFile())
          h.update(p)
            .update("\0")
            .update(fs.readFileSync(path.join(this.root, p)));
      }
    };
    walk(name);
    return h.digest("hex");
  }

  async resolve(owner: string, repo: string, ref: string | undefined): Promise<ResolvedRepository> {
    if (owner !== FIXTURE_OWNER || !this.dirs().includes(repo))
      throw new HostedError(
        "repository_not_found",
        `Offline mode only serves ${FIXTURE_OWNER}/<fixture>`,
      );
    if (ref) throw new HostedError("ref_not_found", "Fixtures have no refs");
    return { owner, repo, commit: this.contentHash(repo), ref: null, sizeKb: 0 };
  }

  async download(r: ResolvedRepository, maxBytes: number): Promise<Buffer> {
    if (!this.dirs().includes(r.repo))
      throw new HostedError("repository_not_found", "Fixture not found");
    const stream = tarCreate({ gzip: true, cwd: this.root, portable: true }, [r.repo]);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      total += chunk.length;
      if (total > maxBytes) throw tooLarge(maxBytes);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
