import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supportedLocales = ['ko', 'en'];
const defaultLocale = 'ko';

// Public 경로 목록 (로그인 없이 접근 가능)
const publicPaths = [
  '/',
  '/about',
  '/how-to-play',
  '/faq',
  '/blog',
  '/privacy',
  '/terms',
  '/contact',
  '/sitemap.xml',
  '/robots.txt',
  '/problems', // 문제 목록은 Public
  '/problem', // 개별 문제 상세는 Public
  '/guess', // 맞추기 게임 목록은 Public
  '/ranking', // 랭킹은 Public
  '/community', // 커뮤니티는 Public
  '/tutorial', // 튜토리얼은 Public
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
  '/liar_room',
  '/mafia_room',
  '/room',
  '/chat',
  '/wallet',
  '/shop',
  '/earn',
];

// 경로가 Public인지 확인
function isPublicPath(pathname: string): boolean {
  // 언어 코드 제거
  const pathWithoutLang = pathname.split('/').slice(2).join('/') || '/';
  const fullPath = '/' + pathWithoutLang;
  
  // 정확히 일치하거나 시작하는 경로 확인
  return publicPaths.some(publicPath => {
    if (publicPath === '/') {
      return pathname === `/${defaultLocale}` || pathname === `/${defaultLocale}/`;
    }
    return fullPath === publicPath || fullPath.startsWith(publicPath + '/');
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
  
  // 정적 파일과 API 라우트는 건너뛰기
  // sitemap.xml과 robots.txt는 SEO를 위해 루트에 유지
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // 언어 코드 추출
  const pathnameHasLocale = supportedLocales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // 루트 경로는 기본 언어로 리다이렉트
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(`/${defaultLocale}`, request.url)
    );
  }

  // 언어 코드가 없는 경우 기본 언어로 리다이렉트
  if (!pathnameHasLocale) {
    // /daily -> /ko/daily
    const newPathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(
      new URL(newPathname, request.url)
    );
  }

  // 잘못된 언어 코드는 기본 언어로 리다이렉트
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0 && !supportedLocales.includes(pathSegments[0])) {
    const restOfPath = pathSegments.slice(1).join('/');
    const newPathname = restOfPath ? `/${defaultLocale}/${restOfPath}` : `/${defaultLocale}`;
    return NextResponse.redirect(
      new URL(newPathname, request.url)
    );
  }

  // Public 경로는 인증 체크 없이 통과
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protected 경로는 인증 체크
  if (isProtectedPath(pathname)) {
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        const lang = pathSegments[0] || defaultLocale;
        const loginUrl = new URL(`/${lang}/auth/login`, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      // 인증 체크 실패 시 로그인 페이지로 리다이렉트
      const lang = pathSegments[0] || defaultLocale;
      const loginUrl = new URL(`/${lang}/auth/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sitemap.xml (sitemap file)
     * - robots.txt (robots file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

