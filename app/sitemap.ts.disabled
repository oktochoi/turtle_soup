import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// 캐싱 설정: 1시간마다 재생성 (3600초)
export const revalidate = 3600;

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
const locales = ['ko', 'en'];

// Sitemap에서 사용할 Supabase 클라이언트 생성 (쿠키/세션 없이)
function createSitemapSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service Role Key가 있으면 사용, 없으면 Anon Key 사용 (읽기 전용)
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables for sitemap generation');
  }

  // 쿠키 없이 직접 클라이언트 생성 (서버 사이드 전용)
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
    const supabase = createSitemapSupabaseClient();

    // 문제 목록 가져오기 (최대 1000개)
    const { data: problems, error: problemsError } = await supabase
      .from('problems')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (!problemsError && problems && problems.length > 0) {
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
    } else if (problemsError) {
      console.error('Sitemap: 문제 목록 가져오기 오류:', problemsError);
    }

    // 커뮤니티 게시글 가져오기 (최대 500개)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (!postsError && posts && posts.length > 0) {
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
    } else if (postsError) {
      console.error('Sitemap: 게시글 목록 가져오기 오류:', postsError);
    }

    // 공개 프로필 가져오기 (최대 200개)
    const { data: gameUsers, error: usersError } = await supabase
      .from('game_users')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!usersError && gameUsers && gameUsers.length > 0) {
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
    } else if (usersError) {
      console.error('Sitemap: 사용자 목록 가져오기 오류:', usersError);
    }
  } catch (error) {
    // Supabase 클라이언트 생성 실패 또는 기타 오류
    console.error('Sitemap 생성 중 오류 발생:', error);
    // 오류가 발생해도 기본 페이지는 포함하여 반환
  }

  return sitemapEntries;
}
