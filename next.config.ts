import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: { "/api/teacher/pdf-imports": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"] },
};

export default nextConfig;
