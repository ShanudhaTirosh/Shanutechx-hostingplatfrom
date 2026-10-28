const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  async redirects() {
    const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3001';
    return [
      {
        source: '/dashboard',
        destination: `${dashboardUrl}/dashboard`,
        permanent: false,
      },
      {
        source: '/dashboard/:path*',
        destination: `${dashboardUrl}/dashboard/:path*`,
        permanent: false,
      },
      {
        source: '/login',
        destination: `${dashboardUrl}/login`,
        permanent: false,
      },
      {
        source: '/register',
        destination: `${dashboardUrl}/login`,
        permanent: false,
      },
      {
        source: '/reset-password',
        destination: `${dashboardUrl}/reset-password`,
        permanent: false,
      },
      {
        source: '/orders',
        destination: `${dashboardUrl}/orders`,
        permanent: false,
      },
      {
        source: '/services',
        destination: `${dashboardUrl}/services`,
        permanent: false,
      },
      {
        source: '/tickets',
        destination: `${dashboardUrl}/tickets`,
        permanent: false,
      },
      {
        source: '/settings',
        destination: `${dashboardUrl}/settings`,
        permanent: false,
      },
      {
        source: '/webmail',
        destination: `${dashboardUrl}/webmail`,
        permanent: false,
      },
      {
        source: '/security.txt',
        destination: '/.well-known/security.txt',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.well-known/security.txt|llms.txt|llms-full.txt|humans.txt|.well-known/mta-sts.txt)',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
