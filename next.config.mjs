/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The main logged-in Home used to live at /kingdom-map (legacy product name). /home is the one
  // canonical URL; every old link/bookmark keeps working through these server-side redirects.
  async redirects() {
    return [
      { source: "/kingdom-map", destination: "/home", permanent: true },
      { source: "/kingdom-map/customize", destination: "/profile/customize", permanent: true },
      { source: "/kingdom-map/board-skin", destination: "/profile/customize", permanent: true },
      { source: "/kingdom-map/piece-set", destination: "/profile/customize", permanent: true },
      { source: "/kingdom-map/journey", destination: "/home/journey", permanent: true },
      { source: "/kingdom-map/:path*", destination: "/home/:path*", permanent: true },
    ];
  },
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
