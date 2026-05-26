import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    localPatterns: [
      { pathname: '/api/media/file/**' },
      { pathname: '/images/**' },
    ],
    remotePatterns: [
      // Gravatar for user avatars
      { protocol: 'https', hostname: 'secure.gravatar.com' },
      // WordPress media from any domain
      { protocol: 'https', hostname: '*.wordpress.com' },
      { protocol: 'https', hostname: '*.wp.com' },
      // Allow client-specific domains
      { protocol: 'https', hostname: '*.local' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      // Generic wildcard for any WordPress/WooCommerce domain
      { protocol: 'https', hostname: '*' },
    ],
  },
};

export default nextConfig;

