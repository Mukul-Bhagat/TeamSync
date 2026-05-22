/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@pipesync/ui",
    "@pipesync/auth",
    "@pipesync/database",
    "@pipesync/hooks",
    "@pipesync/store",
    "@pipesync/utils",
    "@pipesync/realtime",
    "@pipesync/validation",
  ],
  images: {
    remotePatterns: [
      { hostname: "**.supabase.co" },
      { hostname: "localhost" },
    ],
  },
};

module.exports = nextConfig;
