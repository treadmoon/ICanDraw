import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["http://172.20.226.18:3000"],
};

export default nextConfig;
