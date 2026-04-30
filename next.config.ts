import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: [
    "2b29-2804-e24-fd50-9d00-4c58-523c-93ed-e9ee.ngrok-free.app",
  ],
};

export default nextConfig;
