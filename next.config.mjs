/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    browserDebugInfoInTerminal: true,
  },
  // Turbopack handles Node.js built-ins automatically, no explicit config needed
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Security hardening headers (tune at your edge/proxy for production)
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()' },
        ],
      },
      // If COOP/COEP relaxations are required for a specific route, scope them narrowly like below:
      // {
      //   source: '/wallet-popup',
      //   headers: [
      //     { key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' },
      //     { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
      //   ],
      // },
    ]
  },
};

export default nextConfig;
