import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Document parsers for quiz course materials (RAG). pdf-parse wraps
  // pdfjs-dist, which needs native canvas + a worker file on disk, so these
  // must stay as real node_modules instead of being bundled.
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "mammoth",
    "jszip",
  ],
  // material-extract.ts loads pdf.worker.mjs by path at runtime, which file
  // tracing can't see — include it explicitly for serverless deployments.
  outputFileTracingIncludes: {
    "/api/quiz/**/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/join",
        destination: "/quiz/join",
        permanent: false,
      },
      {
        source: "/join/:joinCode",
        destination: "/quiz/join/:joinCode",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
