/**
 * The only package that touches the TypeScript compiler API.
 * Uses the TypeScript bundled with ts-morph; analyzer code depends on this interface only,
 * so a future compiler (e.g. TypeScript 7 native) can be swapped in behind it.
 */
import { builtinModules } from "node:module";
import path from "node:path/posix";
import { ts } from "ts-morph";

export const compilerVersion = `typescript@${ts.version}`;

export type ReferenceKind = "import" | "export" | "require" | "dynamic-import" | "import-type";

export interface ModuleReference {
  specifier: string;
  kind: ReferenceKind;
  typeOnly: boolean;
  line: number;
  column: number;
  text: string;
}

export interface UnsupportedExpression {
  kind: "dynamic-import" | "require";
  line: number;
  column: number;
  text: string;
}

export interface ExtractResult {
  references: ModuleReference[];
  unsupported: UnsupportedExpression[];
  parseErrors: string[];
}

const scriptKindFor = (file: string): ts.ScriptKind => {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(c|m)?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};

const snippet = (node: ts.Node, sf: ts.SourceFile) => {
  const t = node.getText(sf).replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 157)}...` : t;
};

const isStringLike = (
  n: ts.Node | undefined,
): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n));

/** Parse one file (no type checker, no execution) and list its module references. */
export function extractReferences(fileName: string, text: string): ExtractResult {
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName),
  );
  const references: ModuleReference[] = [];
  const unsupported: UnsupportedExpression[] = [];
  const loc = (n: ts.Node) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
    return { line: line + 1, column: character + 1 };
  };
  const add = (specifier: string, kind: ReferenceKind, typeOnly: boolean, node: ts.Node) =>
    references.push({ specifier, kind, typeOnly, ...loc(node), text: snippet(node, sf) });

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && isStringLike(node.moduleSpecifier)) {
      const c = node.importClause;
      const named =
        c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings : undefined;
      const typeOnly =
        !!c &&
        (c.isTypeOnly ||
          (!c.name &&
            !!named &&
            named.elements.length > 0 &&
            named.elements.every((e) => e.isTypeOnly)));
      add(node.moduleSpecifier.text, "import", typeOnly, node);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLike(node.moduleSpecifier)
    ) {
      const ec = node.exportClause;
      const typeOnly =
        node.isTypeOnly ||
        (!!ec &&
          ts.isNamedExports(ec) &&
          ec.elements.length > 0 &&
          ec.elements.every((e) => e.isTypeOnly));
      add(node.moduleSpecifier.text, "export", typeOnly, node);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      isStringLike(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression.text, "require", node.isTypeOnly, node);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      isStringLike(node.argument.literal)
    ) {
      add(node.argument.literal.text, "import-type", true, node);
    } else if (ts.isCallExpression(node)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire =
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1;
      if (isImport || isRequire) {
        const arg = node.arguments[0];
        const kind = isImport ? "dynamic-import" : "require";
        if (isStringLike(arg)) add(arg.text, kind, false, node);
        else unsupported.push({ kind, ...loc(node), text: snippet(node, sf) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const diags = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  const parseErrors = diags.map((d) => {
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    return `${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
  });
  return { references, unsupported, parseErrors };
}

export type Resolved =
  | { kind: "file"; path: string; note?: string }
  | { kind: "external"; name: string }
  | { kind: "builtin"; name: string }
  | { kind: "unresolved"; reason: string };

export interface ResolverOptions {
  /** Absolute POSIX path of the repository root. */
  root: string;
  /** Every repository-relative file path visible to resolution (exact case). */
  files: ReadonlySet<string>;
  /** Reads a repository-relative file (used for package.json / tsconfig only). */
  readFile: (rel: string) => string | undefined;
  /** Workspace package name -> repository-relative package directory ("" = root). */
  workspacePackages: ReadonlyMap<string, string>;
}

export interface ConfigInfo {
  configPath: string | null;
  errors: string[];
}

const builtins = new Set(builtinModules);
const SOURCE_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

export const packageNameOf = (spec: string) => {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
};

/**
 * Module resolver over a virtual, root-confined view of the repository.
 * Nothing outside `root` is read; workspace packages are exposed as virtual node_modules entries.
 */
export function createResolver(opts: ResolverOptions) {
  const root = opts.root.replace(/\/+$/, "");
  const dirs = new Set<string>([""]);
  for (const f of opts.files) {
    let d = path.dirname(f);
    while (d !== "." && !dirs.has(d)) {
      dirs.add(d);
      d = path.dirname(d);
    }
  }

  /** Map an absolute path to repository-relative, applying the virtual node_modules overlay. */
  const toRel = (abs: string): string | null => {
    abs = path.normalize(abs);
    const nm = `${root}/node_modules/`;
    if (abs.startsWith(nm)) {
      const rest = abs.slice(nm.length);
      const name = packageNameOf(rest);
      const dir = opts.workspacePackages.get(name);
      if (dir === undefined) return null;
      const sub = rest.slice(name.length).replace(/^\//, "");
      return path.join(dir || ".", sub).replace(/^\.\/?/, "") || "";
    }
    if (abs === root) return "";
    if (!abs.startsWith(`${root}/`)) return null;
    return abs.slice(root.length + 1);
  };
  const toAbs = (rel: string) => (rel ? `${root}/${rel}` : root);

  const host: ts.ModuleResolutionHost = {
    fileExists: (p) => {
      const r = toRel(p);
      return r !== null && opts.files.has(r);
    },
    readFile: (p) => {
      const r = toRel(p);
      return r !== null && opts.files.has(r) ? opts.readFile(r) : undefined;
    },
    directoryExists: (p) => {
      p = path.normalize(p);
      if (p === `${root}/node_modules`) return opts.workspacePackages.size > 0;
      const scope = p.startsWith(`${root}/node_modules/@`) ? p.slice(root.length + 14) : null;
      if (scope && !scope.includes("/"))
        return [...opts.workspacePackages.keys()].some((n) => n.startsWith(`${scope}/`));
      const r = toRel(p);
      return r !== null && dirs.has(r);
    },
    realpath: (p) => {
      const r = toRel(p);
      return r === null ? p : toAbs(r);
    },
    getCurrentDirectory: () => root,
    getDirectories: () => [],
  };

  const configCache = new Map<
    string,
    { options: ts.CompilerOptions; errors: string[]; cache: ts.ModuleResolutionCache }
  >();
  const nearestConfig = (relFile: string): string | null => {
    let d = path.dirname(relFile);
    for (;;) {
      const base = d === "." ? "" : `${d}/`;
      for (const name of ["tsconfig.json", "jsconfig.json"])
        if (opts.files.has(`${base}${name}`)) return `${base}${name}`;
      if (d === ".") return null;
      d = path.dirname(d);
    }
  };

  const loadConfig = (configPath: string | null) => {
    const key = configPath ?? "";
    const hit = configCache.get(key);
    if (hit) return hit;
    let options: ts.CompilerOptions = {};
    const errors: string[] = [];
    if (configPath) {
      const abs = toAbs(configPath);
      const read = ts.readConfigFile(abs, (p) => host.readFile(p));
      if (read.error) errors.push(ts.flattenDiagnosticMessageText(read.error.messageText, " "));
      else {
        const parseHost: ts.ParseConfigHost = {
          useCaseSensitiveFileNames: true,
          readDirectory: () => [],
          fileExists: host.fileExists,
          readFile: (p) => host.readFile(p),
        };
        const parsed = ts.parseJsonConfigFileContent(
          read.config,
          parseHost,
          path.dirname(abs),
          undefined,
          abs,
        );
        options = parsed.options;
        for (const e of parsed.errors)
          if (e.code !== 18003) errors.push(ts.flattenDiagnosticMessageText(e.messageText, " ")); // 18003: no inputs (readDirectory is stubbed)
      }
    }
    const mr = options.moduleResolution;
    const mod = options.module;
    if (mr === undefined && mod !== ts.ModuleKind.Node16 && mod !== ts.ModuleKind.NodeNext) {
      // No explicit strategy: use bundler semantics (extensionless relative imports + package exports).
      options = {
        ...options,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        module: ts.ModuleKind.ESNext,
      };
    }
    options = { ...options, allowJs: true, resolveJsonModule: true, preserveSymlinks: false };
    const entry = {
      options,
      errors,
      cache: ts.createModuleResolutionCache(root, (s) => s, options),
    };
    configCache.set(key, entry);
    return entry;
  };

  const matchesAlias = (spec: string, options: ts.CompilerOptions) =>
    Object.keys(options.paths ?? {}).some((k) => {
      const star = k.indexOf("*");
      return star < 0
        ? k === spec
        : spec.startsWith(k.slice(0, star)) && spec.endsWith(k.slice(star + 1));
    });

  const workspaceFallback = (spec: string): string | null => {
    const dir = opts.workspacePackages.get(spec);
    if (dir === undefined) return null;
    const base = dir ? `${dir}/` : "";
    let source: string | undefined;
    try {
      source = JSON.parse(opts.readFile(`${base}package.json`) ?? "{}").source;
    } catch {
      /* invalid package.json reported elsewhere */
    }
    const candidates = [
      ...(typeof source === "string" ? [path.normalize(`${base}${source}`)] : []),
      ...SOURCE_EXT.map((e) => `${base}src/index${e}`),
      ...SOURCE_EXT.map((e) => `${base}index${e}`),
    ];
    return candidates.find((c) => opts.files.has(c)) ?? null;
  };

  return {
    configFor(relFile: string): ConfigInfo {
      const configPath = nearestConfig(relFile);
      return { configPath, errors: loadConfig(configPath).errors };
    },

    resolve(spec: string, containingRel: string, mode: "import" | "require"): Resolved {
      if (spec.startsWith("node:") || (builtins.has(spec) && !opts.workspacePackages.has(spec)))
        return { kind: "builtin", name: spec.startsWith("node:") ? spec : `node:${spec}` };
      const { options, cache } = loadConfig(nearestConfig(containingRel));
      const resolutionMode = mode === "require" ? ts.ModuleKind.CommonJS : ts.ModuleKind.ESNext;
      const r = ts.resolveModuleName(
        spec,
        toAbs(containingRel),
        options,
        host,
        cache,
        undefined,
        resolutionMode,
      );
      const resolved = r.resolvedModule?.resolvedFileName;
      if (resolved) {
        const rel = toRel(host.realpath!(resolved));
        if (rel !== null && opts.files.has(rel)) return { kind: "file", path: rel };
      }
      const isRelative = spec.startsWith(".") || spec.startsWith("/");
      if (!isRelative && !spec.startsWith("#") && !matchesAlias(spec, options)) {
        const name = packageNameOf(spec);
        if (opts.workspacePackages.has(name)) {
          const fb = spec === name ? workspaceFallback(name) : null;
          if (fb) return { kind: "file", path: fb, note: "resolved via workspace source fallback" };
          return {
            kind: "unresolved",
            reason: `workspace package "${name}" entry point not found in source`,
          };
        }
        return { kind: "external", name };
      }
      return {
        kind: "unresolved",
        reason: matchesAlias(spec, options)
          ? "path alias matched but no target file exists"
          : spec.startsWith("#")
            ? "package imports mapping did not resolve"
            : "no matching file in repository",
      };
    },
  };
}
