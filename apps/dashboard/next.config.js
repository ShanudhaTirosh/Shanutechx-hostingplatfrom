/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
  },
  
  // Optimize fonts
  optimizeFonts: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['react', 'react-dom'],
  },
  
  async redirects() {
    return [
      {
        source: '/dashbord',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },

  // Add performance headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Webpack optimizations
  webpack: (config, { isServer }) => {
    // Optimize Monaco Editor - only load when needed
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'monaco-editor': '@monaco-editor/react',
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;
