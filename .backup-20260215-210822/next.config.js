const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../'),
    // Tree shaking: barrel file import'larını otomatik optimize et
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'lodash',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'framer-motion',
      'recharts',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Production'da console.log kaldır
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  swcMinify: true,
  poweredByHeader: false,
  compress: true,

  // ═══ GÖRSEL OPTİMİZASYON (eskiden unoptimized: true idi — %60-70 küçülme) ═══
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 604800,
    remotePatterns: [
      { protocol: 'https', hostname: '**.s3.amazonaws.com' },
      { protocol: 'https', hostname: '**.s3.us-west-2.amazonaws.com' },
      { protocol: 'https', hostname: 'cdn.abacus.ai' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },

  // ═══ CACHE HEADERS ═══
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*.(js|css|woff2|png|jpg|webp|avif|svg|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sounds/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
