import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres.js uses Node networking; keep it out of the server bundle.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
