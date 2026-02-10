/**
 * Sitemap 생성을 위한 동적 경로 생성 스크립트
 * Supabase problems 테이블에서 id를 읽어 /ko/problem/{id}, /en/problem/{id} 경로를 생성합니다.
 * postbuild에서 next build 직후 실행되며, 결과는 .next/sitemap-paths.json에 저장됩니다.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const locales = ['ko', 'en'];

/** SERVICE ROLE KEY만 사용. ANON KEY fallback 없음. */
function createSitemapSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[generate-sitemap-paths] SUPABASE_SERVICE_ROLE_KEY(또는 NEXT_PUBLIC_SUPABASE_URL)가 없습니다. ' +
      '문제 DETAIL 경로가 생성되지 않습니다. .env에 SERVICE ROLE KEY를 설정하세요.'
    );
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

  // 기본 페이지 (SEO 허브: 1.0 daily / 리스트·커뮤니티 등: 0.6 weekly)
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
      priority: 1.0,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/community`,
      changefreq: 'weekly',
      priority: 0.6,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/ranking`,
      changefreq: 'weekly',
      priority: 0.6,
      lastmod: new Date().toISOString(),
    });
    paths.push({
      loc: `/${locale}/rooms`,
      changefreq: 'weekly',
      priority: 0.6,
      lastmod: new Date().toISOString(),
    });
  });

  try {
    const supabase = createSitemapSupabaseClient();

    if (supabase) {
      console.log('Fetching problems from Supabase (problems table)...');
      const { data: problems, error: problemsError } = await supabase
        .from('problems')
        .select('id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5000);

      if (problemsError) {
        console.error('[generate-sitemap-paths] problems 조회 실패:', problemsError.message, problemsError);
      } else if (!problems || problems.length === 0) {
        console.error(
          '[generate-sitemap-paths] problems 테이블에서 0건 조회됨. ' +
          'Supabase RLS/권한 및 SUPABASE_SERVICE_ROLE_KEY, problems 테이블 데이터를 확인하세요.'
        );
      } else {
        console.log(`Found ${problems.length} problems`);
        problems.forEach((problem) => {
          locales.forEach((locale) => {
            paths.push({
              loc: `/${locale}/problem/${problem.id}`,
              changefreq: 'weekly',
              priority: 0.9,
              lastmod: problem.updated_at ? new Date(problem.updated_at).toISOString() : new Date().toISOString(),
            });
          });
        });
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
              priority: 0.6,
              lastmod: post.updated_at ? new Date(post.updated_at).toISOString() : new Date().toISOString(),
            });
          });
        });
      } else if (postsError) {
        console.error('Error fetching posts:', postsError);
      }

      // 프로필은 SEO 비핵심 → sitemap에 넣지 않음 (크롤링 예산 절약)
    } else {
      console.log('Skipping Supabase data fetching due to missing environment variables');
    }

    console.log(`Total paths generated: ${paths.length}`);
  } catch (error) {
    console.error('Error generating sitemap paths:', error);
    // 오류가 발생해도 기본 페이지는 포함
  }

  // postbuild에서 next build 직후 실행되므로 .next가 존재함. 여기에 저장하면 next-sitemap이 읽음.
  const nextDir = path.join(process.cwd(), '.next');
  if (!fs.existsSync(nextDir)) {
    fs.mkdirSync(nextDir, { recursive: true });
  }
  const pathsFile = path.join(nextDir, 'sitemap-paths.json');
  fs.writeFileSync(pathsFile, JSON.stringify(paths, null, 2), 'utf8');
  console.log('Sitemap paths saved to .next/sitemap-paths.json');

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

