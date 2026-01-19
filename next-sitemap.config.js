/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app',
  generateRobotsTxt: true,
  sitemapSize: 5000,
  exclude: [
    '/api/*',
    '/admin/*',
    '/auth/*',
    '/room/*',
    '/_next/*',
    '/ko/api/*',
    '/en/api/*',
    '/ko/admin/*',
    '/en/admin/*',
    '/ko/auth/*',
    '/en/auth/*',
    '/ko/room/*',
    '/en/room/*',
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
  // additionalPaths는 빌드 시 동적으로 생성됨
  // scripts/generate-sitemap-paths.js가 먼저 실행되어 .next/sitemap-paths.json을 생성
  additionalPaths: async (config) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const pathsFile = path.join(process.cwd(), '.next', 'sitemap-paths.json');
      if (fs.existsSync(pathsFile)) {
        const paths = JSON.parse(fs.readFileSync(pathsFile, 'utf8'));
        console.log(`Loaded ${paths.length} additional paths from sitemap-paths.json`);
        return paths;
      } else {
        console.warn('Sitemap paths file not found. Make sure scripts/generate-sitemap-paths.js runs before next-sitemap.');
      }
    } catch (error) {
      console.warn('Error loading sitemap paths file:', error.message);
    }
    
    return [];
  },
};

