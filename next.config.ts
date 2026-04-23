import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "6cd5-2804-e24-fd45-6700-ed17-26dc-3fb7-5ed9.ngrok-free.app",
  ],
};

export default nextConfig;
