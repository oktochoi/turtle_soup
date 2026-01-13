import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const locales = ['ko', 'en'];
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // 각 언어별 기본 페이지
  locales.forEach((locale) => {
    sitemapEntries.push(
      {
        url: `${baseUrl}/${locale}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      {
        url: `${baseUrl}/${locale}/problems`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/${locale}/community`,
        lastModified: new Date(),
        changeFrequency: 'hourly',
        priority: 0.9,
      },
      {
        url: `${baseUrl}/${locale}/ranking`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      },
      {
        url: `${baseUrl}/${locale}/rooms`,
        lastModified: new Date(),
        changeFrequency: 'always',
        priority: 0.7,
      }
    );
  });

  try {
    // 문제 목록 가져오기
    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000); // 최대 1000개 문제

    if (!problemsError && problems) {
      problems.forEach((problem) => {
        locales.forEach((locale) => {
          sitemapEntries.push({
            url: `${baseUrl}/${locale}/problem/${problem.id}`,
            lastModified: problem.updated_at ? new Date(problem.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        });
      });
    }

    // 커뮤니티 게시글 가져오기
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500); // 최대 500개 게시글

    if (!postsError && posts) {
      posts.forEach((post) => {
        locales.forEach((locale) => {
          sitemapEntries.push({
            url: `${baseUrl}/${locale}/community/${post.id}`,
            lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        });
      });
    }

    // 공개 프로필 가져오기 (활성 사용자만)
    const { data: gameUsers, error: usersError } = await supabase
      .from('game_users')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200); // 최대 200개 프로필

    if (!usersError && gameUsers) {
      gameUsers.forEach((user) => {
        locales.forEach((locale) => {
          sitemapEntries.push({
            url: `${baseUrl}/${locale}/profile/${user.id}`,
            lastModified: user.updated_at ? new Date(user.updated_at) : new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        });
      });
    }
  } catch (error) {
    console.error('Sitemap 생성 오류:', error);
    // 오류가 발생해도 기본 페이지는 포함
  }

  return sitemapEntries;
}
