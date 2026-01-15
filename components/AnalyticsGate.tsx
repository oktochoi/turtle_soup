'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

/**
 * 조건부 Analytics 컴포넌트
 * 동적 세그먼트가 포함된 상세 페이지만 추적합니다.
 */
export function AnalyticsGate() {
  const pathname = usePathname();

  useEffect(() => {
    // 경로가 변경될 때마다 조건부로 페이지뷰 추적
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  // Analytics 컴포넌트는 렌더링하지 않음
  // 대신 필요한 페이지에서만 track() 호출
  return null;
}

