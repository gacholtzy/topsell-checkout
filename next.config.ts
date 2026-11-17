import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  rewrites: async () => {
    return [
      {
        source: "/backend/:path*",
        // Default ke API lokal (local-api/), bukan produksi: tanpa API_URL repo ini
        // tidak pernah memanggil backend produksi secara tidak sengaja.
        destination:
          process.env.API_URL || "http://localhost:8080/api/v1/:path*",
        // API_URL is a build arg (see docker-compose). In Docker it points at the
        // API container directly (http://st-live:8080/api/v1/:path*): the rewrite
        // runs server side, so going out through Cloudflare and nginx only added
        // two hops and two more timeouts to every call.
      },
    ];
  },
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  // Meminimalkan jumlah chunk
  experimental: {
    optimizeCss: true,
    // The /backend rewrite proxies to the Go API. Next's default gives the
    // upstream 30 s, and a checkout that waits on a slow WooCommerce can take
    // longer; cutting it off left orders created with no payment page shown.
    // 120 s is the budget, and the API itself gives up on WooCommerce first.
    proxyTimeout: 120_000,
  },
  // Atur output untuk mengurangi ukuran bundle
  // output: 'standalone',
};

export default nextConfig;
