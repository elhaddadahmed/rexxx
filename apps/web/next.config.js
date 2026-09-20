/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keine Secrets/API-Keys gehören hier! Umgebungsvariablen kommen aus .env.local
};

module.exports = nextConfig;
