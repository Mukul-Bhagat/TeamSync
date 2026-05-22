/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@vistafam/ui",
    "@vistafam/auth",
    "@vistafam/database",
    "@vistafam/hooks",
    "@vistafam/store",
    "@vistafam/utils",
    "@vistafam/realtime",
    "@vistafam/validation",
  ],
  images: {
    remotePatterns: [
      { hostname: "**.supabase.co" },
      { hostname: "localhost" },
    ],
  },
};

module.exports = nextConfig;
