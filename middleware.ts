import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const supportedLocales = ['ko', 'en'];
const defaultLocale = 'ko';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

