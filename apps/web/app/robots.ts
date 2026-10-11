import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shanutechx.com';

const PUBLIC_ALLOWED_PATHS = [
  '/',
  '/llms.txt',
  '/llms-full.txt',
  '/humans.txt',
  '/.well-known/security.txt',
  '/.well-known/mta-sts.txt',
  '/about',
  '/pricing',
  '/catalog',
  '/vps',
  '/app-hosting',
  '/bot-hosting',
  '/databases',
  '/v2ray',
  '/docs',
  '/faqs',
  '/help',
  '/reviews',
  '/status',
  '/contact',
  '/discord',
  '/terms',
  '/privacy',
  '/refund',
  '/cookies',
];

const PRIVATE_DISALLOWED_PATHS = [
  '/dashboard',
  '/dashboard/*',
  '/api',
  '/api/*',
  '/login',
  '/register',
  '/reset-password',
  '/orders',
  '/services',
  '/tickets',
  '/settings',
  '/webmail',
  '/cart',
  '/checkout',
  '/admin',
  '/_next/*',
  '/private/*',
  '/403',
  '/503',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Standard search engine crawlers (Google, Bing, DuckDuckGo, etc.)
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_DISALLOWED_PATHS,
      },
      // Explicitly allow AI Bots to learn about ShanuTechX business & services while protecting user data
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'anthropic-ai',
          'PerplexityBot',
          'Google-Extended',
          'Applebot-Extended',
          'Amazonbot',
          'cohere-ai',
          'Meta-ExternalAgent',
          'FacebookBot',
          'Bytespider',
          'Diffbot',
          'CCBot',
        ],
        allow: PUBLIC_ALLOWED_PATHS,
        disallow: PRIVATE_DISALLOWED_PATHS,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
