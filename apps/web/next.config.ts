import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages export raw .ts source.
  transpilePackages: ["@archmap/graph-schema", "@archmap/graph-core"],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
};

export default config;
