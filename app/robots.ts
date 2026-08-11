import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

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
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
