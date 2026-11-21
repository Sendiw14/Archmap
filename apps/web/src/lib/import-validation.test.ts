import { describe, expect, it } from "vitest";
import { validateImport } from "./import-validation";

const v = (repository: string, ref = "") => validateImport({ repository, ref });

describe("import form validation", () => {
  it("accepts owner/repo, github.com paths and full URLs, with or without a ref", () => {
    for (const input of [
      "vercel/next.js",
      "github.com/vercel/next.js",
      "https://github.com/vercel/next.js",
      "https://github.com/vercel/next.js.git",
      "  vercel/next.js  ",
      "https://github.com/vercel/next.js/tree/canary",
    ]) {
      const r = v(input);
      expect(r.ok, input).toBe(true);
      if (r.ok) expect(r.repo).toEqual({ owner: "vercel", repo: "next.js" });
    }
    const withRef = v("o/r", "release/1.2");
    expect(withRef.ok && withRef.request).toEqual({ repository: "o/r", ref: "release/1.2" });
    expect(v("o/r", "a".repeat(40)).ok).toBe(true);
  });

  it("omits an empty ref from the request", () => {
    const r = v("o/r", "   ");
    expect(r.ok && r.request).toEqual({ repository: "o/r", ref: undefined });
  });

  it("explains an empty field", () => {
    const r = v("   ");
    expect(r).toEqual({
      ok: false,
      errors: { repository: expect.stringContaining("Enter a GitHub repository") },
    });
  });

  it("rejects other hosts, schemes and providers with a provider message", () => {
    for (const input of [
      "https://gitlab.com/o/r",
      "https://bitbucket.org/o/r",
      "git@github.com:o/r.git",
      "ftp://github.com/o/r",
      "https://evil.example/github.com/o/r",
      "https://github.com.evil.example/o/r",
      "https://user:pw@github.com/o/r",
    ]) {
      const r = v(input);
      expect(r.ok, input).toBe(false);
      if (!r.ok) expect(r.errors.repository, input).toBeTruthy();
    }
    const r = v("https://gitlab.com/o/r");
    expect(!r.ok && r.errors.repository).toContain("github.com");
  });

  it("rejects malformed owner/repo", () => {
    for (const input of [
      "justone",
      "o/",
      "/r",
      "-o/r",
      "o-/r",
      "o/r r",
      "o/..",
      "../etc/passwd",
      "o/r;rm -rf",
    ]) {
      expect(v(input).ok, input).toBe(false);
    }
  });

  it("rejects hostile refs and over-long input", () => {
    for (const ref of [
      "--upload-pack=x",
      "a..b",
      "a b",
      "a//b",
      "x\ny",
      "$(id)",
      "a".repeat(201),
    ]) {
      const r = v("o/r", ref);
      expect(r.ok, ref).toBe(false);
      if (!r.ok) expect(r.errors.ref, ref).toBeTruthy();
    }
    expect(v(`o/${"r".repeat(301)}`).ok).toBe(false);
  });

  it("reports both errors at once", () => {
    const r = v("nope", "a..b");
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["ref", "repository"]);
  });
});
