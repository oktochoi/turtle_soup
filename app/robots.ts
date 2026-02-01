import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/ko/',
          '/en/',
          '/ko/about',
          '/en/about',
          '/ko/faq',
          '/en/faq',
          '/ko/privacy',
          '/en/privacy',
          '/ko/terms',
          '/en/terms',
          '/ko/contact',
          '/en/contact',
          '/ko/problems',
          '/en/problems',
          '/ko/problem/',
          '/en/problem/',
          '/ko/guess',
          '/en/guess',
          '/ko/ranking',
          '/en/ranking',
          '/ko/community',
          '/en/community',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/play/',
          '/submit/',
          '/mypage/',
          '/profile/',
          '/create-',
          '/edit/',
          '/turtle_room/',
          '/liar_room/',
          '/mafia_room/',
          '/room/',
          '/chat/',
          '/wallet/',
          '/shop/',
          '/earn/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

