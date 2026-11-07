import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An isolated build directory allows browser QA alongside the local dev server.
  distDir: process.env.MAATRUCARE_BUILD_DIR || ".next",
  reactCompiler: true,
};

export default nextConfig;
