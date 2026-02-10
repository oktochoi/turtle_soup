/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app',
  generateRobotsTxt: true,
  sitemapSize: 5000,
  exclude: [
    '/sitemap.xml',
    '/sitemap-*.xml',
    '/robots.txt',
    '/api/*',
    '/admin/*',
    '/auth/*',
    '/room/*',
    '/turtle_room/*',
    '/liar_room/*',
    '/mafia_room/*',
    '/chat/*',
    '/profile/*',
    '/create-*',
    '/wallet',
    '/shop',
    '/earn',
    '/_next/*',
    '/ko/api/*',
    '/en/api/*',
    '/ko/admin/*',
    '/en/admin/*',
    '/ko/auth/*',
    '/en/auth/*',
    '/ko/room/*',
    '/en/room/*',
    '/ko/turtle_room/*',
    '/en/turtle_room/*',
    '/ko/liar_room/*',
    '/en/liar_room/*',
    '/ko/mafia_room/*',
    '/en/mafia_room/*',
    '/ko/chat/*',
    '/en/chat/*',
    '/ko/profile/*',
    '/en/profile/*',
    '/ko/create-*',
    '/en/create-*',
    '/ko/wallet',
    '/en/wallet',
    '/ko/shop',
    '/en/shop',
    '/ko/earn',
    '/en/earn',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/room/', '/_next/', '/admin/'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/auth/', '/room/'],
      },
    ],
    additionalSitemaps: [],
  },
  /**
   * 페이지별 priority / changefreq 커스텀
   * (여기서 sitemap-0.xml에 들어가는 값이 실제로 결정됨)
   */
  transform: async (config, path) => {
    const url = path;

    // sitemap.xml, robots.txt는 sitemap에 절대 포함하지 않음 (이중 차단)
    if (url === '/sitemap.xml' || url === '/robots.txt' || /^\/sitemap-\d+\.xml$/.test(url)) {
      return null;
    }

    // 기본값
    let priority = 0.5;
    let changefreq = 'weekly';

    // 1. 핵심 허브
    if (url === '/ko' || url === '/en' || url === '/') {
      priority = 1.0;
      changefreq = 'daily';
    } else if (url === '/ko/problems' || url === '/en/problems') {
      // 대표 문제 리스트
      priority = 1.0;
      changefreq = 'daily';
    }
    // 2. 문제 DETAIL
    else if (/^\/(ko|en)\/problem\/[^/]+$/.test(url)) {
      priority = 0.9;
      changefreq = 'weekly';
    }
    // 3. 플레이 진입 / 가이드
    else if (/^\/(ko|en)\/(play|tutorial|guide|faq)$/.test(url)) {
      priority = 0.8;
      changefreq = 'daily';
    }
    // 4. 커뮤니티 / 랭킹 / 방 목록 / 정보
    else if (/^\/(ko|en)\/(community|ranking|rooms|about|contact)(\/.*)?$/.test(url)) {
      priority = 0.6;
      changefreq = 'weekly';
    }
    // 5. 방 / 세션 (실시간)
    else if (/^\/(ko|en)\/(room|turtle_room|liar_room|mafia_room|chat)\/.+$/.test(url)) {
      priority = 0.4;
      changefreq = 'monthly';
    }
    // 6. 로그인 / 프로필 / 생성 / 결제 (대부분 exclude지만, 남아 있어도 값 낮게)
    else if (
      /^\/(ko|en)\/(auth|profile|wallet|shop|earn)(\/.*)?$/.test(url) ||
      /^\/(ko|en)\/create-/.test(url)
    ) {
      priority = 0.2;
      changefreq = 'never';
    }

    return {
      loc: url,
      changefreq,
      priority,
      lastmod: config.autoLastmod ? new Date().toISOString() : undefined,
    };
  },
  // postbuild에서 generate-sitemap-paths.js가 먼저 실행된 뒤 생성된 .next/sitemap-paths.json 로드
  additionalPaths: async (config) => {
    const fs = require('fs');
    const path = require('path');
    const pathsFile = path.join(process.cwd(), '.next', 'sitemap-paths.json');

    try {
      if (fs.existsSync(pathsFile)) {
        const raw = fs.readFileSync(pathsFile, 'utf8');
        const paths = JSON.parse(raw);
        const problemCount = paths.filter((p) => p.loc && /\/problem\/[^/]+$/.test(p.loc)).length;
        console.log(`Loaded ${paths.length} additional paths from sitemap-paths.json (problem DETAIL: ${problemCount})`);
        return paths;
      }
    } catch (err) {
      console.warn('Error loading sitemap paths file:', err.message);
    }
    console.warn('Sitemap paths file not found. postbuild must run: node scripts/generate-sitemap-paths.js && npx next-sitemap');
    return [];
  },
};

