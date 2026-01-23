/**
 * Sitemap 생성을 위한 동적 경로 생성 스크립트
 * Supabase에서 데이터를 가져와서 next-sitemap에 전달할 경로를 생성합니다.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
const locales = ['ko', 'en'];

// Supabase 클라이언트 생성 (쿠키/세션 없이)
function createSitemapSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ Missing Supabase environment variables for sitemap generation. Using static paths only.');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function generateSitemapPaths() {
  const paths = [];

  // 기본 페이지들
  locales.forEach((locale) => {
    paths.push({
      loc: `/${locale}`,
      changefreq: 'daily',
      priority: 1.0,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/problems`,
      changefreq: 'daily',
      priority: 0.9,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/community`,
      changefreq: 'hourly',
      priority: 0.9,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/ranking`,
      changefreq: 'daily',
      priority: 0.8,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/rooms`,
      changefreq: 'always',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    });
  });

  try {
    const supabase = createSitemapSupabaseClient();

    if (supabase) {
      // 문제 목록 가져오기 (최대 1000개)
      console.log('Fetching problems from Supabase...');
      const { data: problems, error: problemsError } = await supabase
        .from('problems')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000);

      if (!problemsError && problems && problems.length > 0) {
        console.log(`Found ${problems.length} problems`);
        problems.forEach((problem) => {
          locales.forEach((locale) => {
            paths.push({
              loc: `/${locale}/problem/${problem.id}`,
              changefreq: 'weekly',
              priority: 0.8,
              lastmod: problem.updated_at ? new Date(problem.updated_at).toISOString() : new Date().toISOString(),
            });
          });
        });
      } else if (problemsError) {
        console.error('Error fetching problems:', problemsError);
      }

      // 커뮤니티 게시글 가져오기 (최대 500개)
      console.log('Fetching posts from Supabase...');
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

      if (!postsError && posts && posts.length > 0) {
        console.log(`Found ${posts.length} posts`);
        posts.forEach((post) => {
          locales.forEach((locale) => {
            paths.push({
              loc: `/${locale}/community/${post.id}`,
              changefreq: 'weekly',
              priority: 0.7,
              lastmod: post.updated_at ? new Date(post.updated_at).toISOString() : new Date().toISOString(),
            });
          });
        });
      } else if (postsError) {
        console.error('Error fetching posts:', postsError);
      }

      // 공개 프로필 가져오기 (최대 200개)
      console.log('Fetching game_users from Supabase...');
      const { data: gameUsers, error: usersError } = await supabase
        .from('game_users')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (!usersError && gameUsers && gameUsers.length > 0) {
        console.log(`Found ${gameUsers.length} game users`);
        gameUsers.forEach((user) => {
          locales.forEach((locale) => {
            paths.push({
              loc: `/${locale}/profile/${user.id}`,
              changefreq: 'monthly',
              priority: 0.6,
              lastmod: user.updated_at ? new Date(user.updated_at).toISOString() : new Date().toISOString(),
            });
          });
        });
      } else if (usersError) {
        console.error('Error fetching game_users:', usersError);
      }
    } else {
      console.log('Skipping Supabase data fetching due to missing environment variables');
    }

    console.log(`Total paths generated: ${paths.length}`);
  } catch (error) {
    console.error('Error generating sitemap paths:', error);
    // 오류가 발생해도 기본 페이지는 포함
  }

  // .next 디렉토리가 없으면 생성
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    fs.mkdirSync(nextDir, { recursive: true });
  }

  // 경로를 JSON 파일로 저장
  const pathsFile = path.join(nextDir, 'sitemap-paths.json');
  fs.writeFileSync(pathsFile, JSON.stringify(paths, null, 2));
  console.log(`Sitemap paths saved to: ${pathsFile}`);

  return paths;
}

// 스크립트 실행
if (require.main === module) {
  generateSitemapPaths()
    .then(() => {
      console.log('Sitemap paths generation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to generate sitemap paths:', error);
      process.exit(1);
    });
}

module.exports = { generateSitemapPaths };

