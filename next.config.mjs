/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Keep WebView from serving stale HTML after a deploy (JS/CSS stay hashed).
        source: "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
