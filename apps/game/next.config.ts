import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optional isolated output for QA alongside an already running career build.
  distDir: process.env.HM_NEXT_DIST_DIR || '.next',
  transpilePackages: [
    "@handball-manager/game-simulation",
    "@handball-manager/handball-engine",
    "@handball-manager/match-contract",
    "@handball-manager/match-integration",
    "@handball-manager/match-renderer",
  ],
};

export default nextConfig;
