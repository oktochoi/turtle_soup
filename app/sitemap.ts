import { MetadataRoute } from 'next';
import { getAllBlogPosts } from '@/lib/blog-posts';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllBlogPosts();
  
  const routes = [
    '',
    '/about',
    '/how-to-play',
    '/faq',
    '/blog',
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

    // 블로그 포스트
    blogPosts.forEach((post) => {
      sitemapEntries.push({
        url: `${siteUrl}/${lang}/blog/${post.slug}`,
        lastModified: new Date(post.publishedAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    });
  });

  return sitemapEntries;
}

