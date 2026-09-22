/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keine Secrets/API-Keys gehören hier! Umgebungsvariablen kommen aus .env.local
};

module.exports = nextConfig;
