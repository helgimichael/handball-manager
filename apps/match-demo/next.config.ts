import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@handball-manager/handball-engine",
    "@handball-manager/match-contract",
    "@handball-manager/match-integration",
    "@handball-manager/match-renderer",
  ],
};

export default nextConfig;
