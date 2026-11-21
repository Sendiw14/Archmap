import { CreateAnalysisRequest, parseRepositoryInput, type RepositoryId } from "@archmap/contracts";

export interface ImportFormValues {
  repository: string;
  ref: string;
}

export type ImportValidation =
  | { ok: true; request: CreateAnalysisRequest; repo: RepositoryId }
  | { ok: false; errors: { repository?: string; ref?: string } };

const looksLikeUrl = (s: string) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(?:[\w-]+\.)+[a-z]{2,}\//i.test(s) || s.includes("@");

/**
 * Client-side validation with the same functions the API uses (parseRepositoryInput and
 * CreateAnalysisRequest), so the form rejects exactly what the server would reject. The server
 * still validates; this only gives faster, kinder feedback.
 */
export function validateImport(values: ImportFormValues): ImportValidation {
  const repository = values.repository.trim();
  const ref = values.ref.trim();
  const errors: { repository?: string; ref?: string } = {};

  if (!repository) errors.repository = "Enter a GitHub repository, for example vercel/next.js.";
  else {
    const repo = parseRepositoryInput(repository);
    if (!repo) {
      errors.repository = looksLikeUrl(repository)
        ? "Only public github.com repositories are supported. Other hosts and Git providers are not."
        : "That is not a valid repository. Use owner/repo or a github.com URL.";
    }
  }

  const request = CreateAnalysisRequest.safeParse({ repository, ref: ref || undefined });
  if (!request.success) {
    for (const issue of request.error.issues) {
      if (issue.path[0] === "ref")
        errors.ref ??=
          "That is not a valid branch, tag or commit SHA. Leave it empty for the default branch.";
      else if (issue.path[0] === "repository")
        errors.repository ??= "Enter a GitHub repository, for example vercel/next.js.";
    }
  }
  if (errors.repository || errors.ref || !request.success) return { ok: false, errors };
  return { ok: true, request: request.data, repo: parseRepositoryInput(repository)! };
}
