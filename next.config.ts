import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'central.prag.global' },
      { protocol: 'https', hostname: 'prag.global' },
      { protocol: 'https', hostname: 'secure.gravatar.com' },
      { protocol: 'https', hostname: '*.wp.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_STORE_URL: process.env.NEXT_PUBLIC_STORE_URL ?? 'https://prag.global',
  },
};

export default nextConfig;
