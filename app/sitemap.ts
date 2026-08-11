import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  const staticRoutes = [
    { path: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/problems', changeFrequency: 'daily' as const, priority: 1.0 },
    { path: '/problems/legend', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: '/problems/hard', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: '/problems/scary', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: '/problems/easy', changeFrequency: 'weekly' as const, priority: 0.9 },
    { path: '/problems/latest', changeFrequency: 'daily' as const, priority: 0.9 },
    { path: '/ranking', changeFrequency: 'daily' as const, priority: 0.7 },
    { path: '/rooms', changeFrequency: 'daily' as const, priority: 0.7 },
    { path: '/guide', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/faq', changeFrequency: 'monthly' as const, priority: 0.6 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
    { path: '/contact', changeFrequency: 'yearly' as const, priority: 0.3 },
  ];

  for (const route of staticRoutes) {
    entries.push({
      url: `${siteUrl}/ko${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  // 동적 문제 URL — 공개 문제만 포함
  try {
    const supabase = await createClient();

    const { data: problems } = await supabase
      .from('problems')
      .select('id, updated_at, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (problems) {
      for (const problem of problems) {
        const lastMod = problem.updated_at || problem.created_at || new Date().toISOString();
        entries.push({
          url: `${siteUrl}/ko/problem/${problem.id}`,
          lastModified: new Date(lastMod),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }
  } catch (e) {
    console.warn('sitemap: failed to fetch problems', e);
  }

  return entries;
}
