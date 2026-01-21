import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'explorer-api.walletconnect.com',
        pathname: '/v3/logo/**',
      },
    ],
  },
};

export default nextConfig;
