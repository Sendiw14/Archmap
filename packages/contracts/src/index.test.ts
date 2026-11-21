import { describe, expect, it } from "vitest";
import {
  JobStatus,
  TRANSITIONS,
  canTransition,
  isTerminal,
  parseRepositoryInput,
} from "./index.ts";

describe("parseRepositoryInput", () => {
  it.each([
    ["vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["github.com/a-b/c_d", { owner: "a-b", repo: "c_d" }],
    ["https://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["https://www.github.com/owner/repo/tree/main/src", { owner: "owner", repo: "repo" }],
    ["  owner/repo  ", { owner: "owner", repo: "repo" }],
  ])("accepts %s", (input, want) => expect(parseRepositoryInput(input)).toEqual(want));

  it.each([
    "",
    "owner",
    "-owner/repo",
    "owner-/repo",
    "ow--ner/repo",
    "owner/..",
    "owner/.",
    "https://gitlab.com/a/b",
    "https://github.com.evil.com/a/b",
    "https://user:pass@github.com/a/b",
    "https://github.com:8443/a/b",
    "ftp://github.com/a/b",
    "file:///etc/passwd",
    "git@github.com:a/b.git",
    "http://169.254.169.254/latest",
    `${"a".repeat(40)}/repo`,
    `owner/${"r".repeat(101)}`,
  ])("rejects %j", (input) => expect(parseRepositoryInput(input)).toBeNull());
});

describe("job state machine", () => {
  it("only allows forward transitions; expired is final", () => {
    expect(canTransition("queued", "fetching")).toBe(true);
    expect(canTransition("completed", "queued")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
    expect(TRANSITIONS.expired).toEqual([]);
    for (const s of JobStatus.options)
      if (isTerminal(s) && s !== "expired") expect(TRANSITIONS[s]).toEqual(["expired"]);
  });
});
