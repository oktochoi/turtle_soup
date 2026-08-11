import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supportedLocales = ['ko'] as const;
type SupportedLocale = (typeof supportedLocales)[number];
const defaultLocale: SupportedLocale = 'ko';

function isSupportedLocale(s: string): s is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(s);
}

/** SEO·사이트 검증용 정적 파일 — middleware 로직 없이 즉시 통과 (matcher에서도 제외) */
const STATIC_SEO_PATHS = [
  '/ads.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon.png',
  '/og.png',
] as const;

const SITEMAP_PREFIX = '/sitemap-';

function shouldSkipMiddleware(pathname: string): boolean {
  if (STATIC_SEO_PATHS.some((p) => pathname === p)) return true;
  if (pathname.startsWith(SITEMAP_PREFIX) && pathname.endsWith('.xml')) return true;
  return false;
}

function detectPreferredLocale(_request: NextRequest): string {
  return defaultLocale;
}

// Public 경로 목록 (로그인 없이 접근 가능)
const publicPaths = [
  '/',
  '/faq',
  '/privacy',
  '/terms',
  '/contact',
  '/auth', // 인증 관련 페이지는 Public
  '/problems', // 문제 목록은 Public
  '/problem', // 개별 문제 상세는 Public
  '/ranking', // 랭킹은 Public
  '/guide', // 가이드는 Public
];

// 인증이 필요한 경로 (로그인 필수)
const protectedPaths = [
  '/play',
  '/submit',
  '/mypage',
  '/profile',
  '/admin',
  '/create-problem',
  '/create-room',
  '/create',
  '/edit',
  '/turtle_room',
  '/room',
];

// 경로가 Public인지 확인
function isPublicPath(pathname: string): boolean {
  // 언어 코드 제거
  const pathWithoutLang = pathname.split('/').slice(2).join('/') || '/';
  const fullPath = '/' + pathWithoutLang;
  
  // Protected 경로는 Public이 아님
  if (isProtectedPath(pathname)) {
    return false;
  }
  
  // 정확히 일치하거나 시작하는 경로 확인
  return publicPaths.some(publicPath => {
    if (publicPath === '/') {
      return pathname === `/${defaultLocale}` || pathname === `/${defaultLocale}/`;
    }
    // 정확히 일치하거나, publicPath로 시작하되 protected 경로가 아닌 경우
    if (fullPath === publicPath) {
      return true;
    }
    // publicPath로 시작하는 경우
    if (fullPath.startsWith(publicPath + '/')) {
      // 하지만 protected 경로는 제외
      const remainingPath = fullPath.slice(publicPath.length);
      return !isProtectedPath(pathname);
    }
    return false;
  });
}

// 경로가 Protected인지 확인
function isProtectedPath(pathname: string): boolean {
  const pathWithoutLang = pathname.split('/').slice(2).join('/') || '/';
  const fullPath = '/' + pathWithoutLang;
  
  return protectedPaths.some(protectedPath => {
    return fullPath.startsWith(protectedPath);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // SEO·사이트 검증 정적 파일 — locale/auth/redirect 적용 없이 즉시 통과
  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next();
  }

  // 정적 파일과 API 라우트는 건너뛰기
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // 언어 코드 추출
  const pathnameHasLocale = supportedLocales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // /en → /ko 301 redirect (기존 영어 URL 보존)
  if (pathname.startsWith('/en/') || pathname === '/en') {
    const restOfPath = pathname === '/en' ? '' : pathname.slice(3);
    const newUrl = new URL(`/ko${restOfPath}`, request.url);
    return NextResponse.redirect(newUrl, 301);
  }

  // 루트 경로는 /ko로 리다이렉트
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/ko', request.url));
  }

  // 언어 코드가 없는 경우 /ko로 리다이렉트
  if (!pathnameHasLocale) {
    return NextResponse.redirect(new URL(`/ko${pathname}`, request.url));
  }

  // 잘못된 언어 코드는 /ko로 리다이렉트
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0 && !isSupportedLocale(pathSegments[0])) {
    const restOfPath = pathSegments.slice(1).join('/');
    const newPathname = restOfPath ? `/ko/${restOfPath}` : '/ko';
    return NextResponse.redirect(new URL(newPathname, request.url), 301);
  }

  // Protected 경로는 페이지 레벨에서 인증 체크하도록 통과
  // middleware에서 인증 체크를 하면 쿠키 문제로 인해 모든 페이지가 막힐 수 있음
  // 인증은 각 페이지 컴포넌트에서 처리하도록 함
  if (isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  // Public 경로는 인증 체크 없이 통과
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 나머지 경로도 통과 (명시적으로 public/protected가 아닌 경우)
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * SEO·정적 파일은 제외 — middleware 실행 자체를 스킵
     * - api, _next/static, _next/image
     * - ads.txt, robots.txt, sitemap.xml, sitemap-*.xml
     * - favicon.ico, apple-touch-icon.png, icon.png, og.png
     */
    '/((?!api|_next/static|_next/image|ads\\.txt|robots\\.txt|sitemap\\.xml|sitemap-|favicon\\.ico|apple-touch-icon\\.png|icon\\.png|og\\.png).*)',
  ],
};

