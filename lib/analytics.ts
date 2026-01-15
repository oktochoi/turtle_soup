/**
 * Vercel Analytics 조건부 트래킹 유틸리티
 * 동적 세그먼트가 포함된 상세 페이지만 추적합니다.
 */

import { track } from '@vercel/analytics';

/**
 * 경로가 추적 대상인지 확인
 * 동적 세그먼트가 포함된 상세 페이지만 true 반환
 */
export function shouldTrackPath(pathname: string): boolean {
  // 쿼리스트링 제거
  const path = pathname.split('?')[0];
  
  // 허용된 패턴들
  const allowedPatterns = [
    // 문제 상세 페이지: /ko/problem/[id] 또는 /problem/[id]
    /^\/[^\/]+\/problem\/[^\/]+$/,
    /^\/problem\/[^\/]+$/,
    // 방 상세 페이지: /ko/room/[code] 또는 /room/[code]
    /^\/[^\/]+\/room\/[^\/]+$/,
    /^\/room\/[^\/]+$/,
    // 커뮤니티 게시글 상세: /ko/community/[id] 또는 /community/[id]
    /^\/[^\/]+\/community\/[^\/]+$/,
    /^\/community\/[^\/]+$/,
  ];

  return allowedPatterns.some(pattern => pattern.test(path));
}

/**
 * 경로 타입 추출
 */
export function getPathType(pathname: string): 'problem' | 'room' | 'community' | null {
  const path = pathname.split('?')[0];
  
  if (/\/problem\/[^\/]+$/.test(path)) {
    return 'problem';
  }
  if (/\/room\/[^\/]+$/.test(path)) {
    return 'room';
  }
  if (/\/community\/[^\/]+$/.test(path)) {
    return 'community';
  }
  
  return null;
}

/**
 * 조건부 페이지뷰 이벤트 기록
 */
export function trackPageView(pathname: string) {
  if (!shouldTrackPath(pathname)) {
    return;
  }

  const pathType = getPathType(pathname);
  if (!pathType) {
    return;
  }

  const eventName = `page_view_${pathType}_detail`;
  
  track(eventName, {
    path: pathname,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 커스텀 이벤트 기록 (추적 대상 경로에서만)
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, any>,
  pathname?: string
) {
  // pathname이 제공된 경우 경로 체크
  if (pathname && !shouldTrackPath(pathname)) {
    return;
  }

  track(eventName, properties);
}

