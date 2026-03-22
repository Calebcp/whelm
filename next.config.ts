import type { NextConfig } from "next";

const staticExport = process.env.CAP_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport
    ? {
        output: "export" as const,
        images: {
          unoptimized: true,
        },
      }
    : {}),
};

export default nextConfig;
