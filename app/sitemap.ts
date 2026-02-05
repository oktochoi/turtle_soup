import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

/** 빌드/요청 시마다 실행되어 항상 최신 URL·lastModified 반환 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    '',
    '/about',
    '/faq',
    '/privacy',
    '/terms',
    '/contact',
    '/problems',
    '/ranking',
    '/community',
    '/tutorial',
    '/guide',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // 기본 라우트 (한국어, 영어)
  ['ko', 'en'].forEach((lang) => {
    routes.forEach((route) => {
      sitemapEntries.push({
        url: `${siteUrl}/${lang}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1.0 : 0.8,
      });
    });
  });

  return sitemapEntries;
}

