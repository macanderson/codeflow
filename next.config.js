/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    E2B_API_KEY: process.env.E2B_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
  webpack: (config) => {
    // Handle WebSocket connections properly
    config.externals = [...config.externals, { ws: 'ws' }];
    return config;
  },
};

module.exports = nextConfig;