/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is now the default bundler in Next.js 16
  // browserDebugInfoInTerminal is now stable and enabled by default
  
  // Webpack optimization to handle empty chunks
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent empty polyfills chunk by optimizing splitChunks
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            // Only create polyfills chunk if there are actual polyfills
            polyfills: {
              test: /[\\/]node_modules[\\/](core-js|regenerator-runtime|@babel[\\/]runtime)[\\/]/,
              name: 'polyfills',
              chunks: 'all',
              enforce: true,
              minSize: 0, // Allow empty chunks to be merged
            },
            // Merge small chunks to prevent empty chunks
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
              minSize: 0,
            },
          },
        },
      };
    }
    return config;
  },
  
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
