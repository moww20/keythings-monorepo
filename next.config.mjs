import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack-specific alias to stub Node N-API module (applies to all targets including client SSR)
  turbopack: {
    resolveAlias: {
      // Use relative specifiers to avoid Windows absolute path issue in Turbopack
      '@keetanetwork/asn1-napi-rs': './src/lib/explorer/stubs/asn1-napi-rs.js',
      '@keetanetwork/asn1-napi-rs/index.js': './src/lib/explorer/stubs/asn1-napi-rs.js',
    },
  },
  // Webpack optimization to handle empty chunks
  webpack: (config, { isServer }) => {
    // Alias the native module to our browser stub for webpack, too
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@keetanetwork/asn1-napi-rs': path.resolve(__dirname, './src/lib/explorer/stubs/asn1-napi-rs.js'),
      '@keetanetwork/asn1-napi-rs/index.js': path.resolve(__dirname, './src/lib/explorer/stubs/asn1-napi-rs.js'),
    };

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

  async redirects() {
    const docsBase = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.keythings.xyz';
    return [
      {
        source: '/docs',
        destination: docsBase,
        permanent: true,
      },
      {
        source: '/docs/:path*',
        destination: `${docsBase}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
