/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
    ];
  },
};

module.exports = nextConfig;
