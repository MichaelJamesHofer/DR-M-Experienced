import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoName = "DR-M-Experienced";
const isGithubPages = process.env.GITHUB_PAGES === "true";
const hasCustomDomain = fs.existsSync("./CNAME");
const shouldUseBasePath = isGithubPages && !hasCustomDomain;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  outputFileTracingRoot: __dirname,
  trailingSlash: true,
  basePath: shouldUseBasePath ? `/${repoName}` : undefined,
  assetPrefix: shouldUseBasePath ? `/${repoName}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
