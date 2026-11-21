import fs from "node:fs";
import path from "node:path";
import { Unpack } from "tar";
import { HostedError } from "./ports.ts";

export interface ExtractLimits {
  maxExtractedBytes: number;
  maxArchiveEntries: number;
  /** Skip (do not write) individual files above this size; they are reported, not fatal. */
  maxFileBytes: number;
}

export interface ExtractResult {
  files: number;
  bytes: number;
  skippedLinks: number;
  skippedLarge: number;
  skippedOther: number;
}

/**
 * Extract a GitHub-style .tar.gz (single top-level directory, stripped) into `dest`.
 * - Only regular files and directories are written; symlinks, hard links and devices are skipped.
 * - Absolute paths and ".." are rejected by tar (preservePaths=false) and re-checked here.
 * - Aborts as soon as total declared bytes or entry count exceed the limits (decompression-bomb guard).
 */
export async function safeExtract(
  archive: Buffer,
  dest: string,
  limits: ExtractLimits,
): Promise<ExtractResult> {
  fs.mkdirSync(dest, { recursive: true });
  const root = fs.realpathSync(dest);
  const result: ExtractResult = {
    files: 0,
    bytes: 0,
    skippedLinks: 0,
    skippedLarge: 0,
    skippedOther: 0,
  };
  let entries = 0;
  let failure: HostedError | null = null;

  const unpack = new Unpack({
    cwd: root,
    strip: 1,
    preservePaths: false,
    preserveOwner: false,
    noMtime: true,
    maxDepth: 64,
    filter: (p, entry) => {
      if (failure) return false;
      entries++;
      if (entries > limits.maxArchiveEntries) {
        failure = new HostedError(
          "limit_exceeded",
          `Archive has more than ${limits.maxArchiveEntries} entries`,
        );
        unpack.abort(failure);
        return false;
      }
      const type = "type" in entry ? entry.type : "File";
      if (type === "SymbolicLink" || type === "Link") {
        result.skippedLinks++;
        return false;
      }
      if (
        type !== "File" &&
        type !== "OldFile" &&
        type !== "ContiguousFile" &&
        type !== "Directory"
      ) {
        result.skippedOther++;
        return false;
      }
      const rel = p.split("/").slice(1).join("/"); // strip top-level dir
      const target = path.resolve(root, rel);
      if (
        rel.split("/").includes("..") ||
        (target !== root && !target.startsWith(root + path.sep))
      ) {
        result.skippedOther++;
        return false;
      }
      if (type === "Directory") return true;
      const size = entry.size ?? 0;
      if (size > limits.maxFileBytes) {
        result.skippedLarge++;
        return false;
      }
      result.bytes += size;
      if (result.bytes > limits.maxExtractedBytes) {
        failure = new HostedError(
          "limit_exceeded",
          `Extracted source exceeds ${Math.round(limits.maxExtractedBytes / 1024 / 1024)} MiB`,
        );
        unpack.abort(failure);
        return false;
      }
      result.files++;
      return true;
    },
  });

  await new Promise<void>((resolve, reject) => {
    unpack.on("close", () => resolve());
    unpack.on("error", (err: Error) => reject(err));
    unpack.end(archive);
  }).catch((err: unknown) => {
    if (failure) throw failure;
    throw new HostedError(
      "limit_exceeded",
      `Archive could not be extracted: ${(err as Error).message}`,
    );
  });
  if (failure) throw failure;
  return result;
}
