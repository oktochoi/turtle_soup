import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-config';

const siteUrl = getSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/profile/',
          '/create-problem',
          '/create-room',
          '/turtle_room/',
          '/room/',
          '/play/',
          '/_next/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
