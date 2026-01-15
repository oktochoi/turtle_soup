'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Analytics } from '@vercel/analytics/react';
import { trackPageView } from '@/lib/analytics';

/**
 * 조건부 Analytics 컴포넌트
 * 동적 세그먼트가 포함된 상세 페이지만 추적합니다.
 * Analytics 컴포넌트는 실시간 기능(online count)을 위해 렌더링합니다.
 * 자동 pageview는 그대로 두되, 우리가 원하는 경로에서만 추가 커스텀 이벤트를 기록합니다.
 */
export function AnalyticsGate() {
  const pathname = usePathname();

  useEffect(() => {
    // 경로가 변경될 때마다 조건부로 커스텀 페이지뷰 이벤트 추적
    // Analytics 컴포넌트의 자동 pageview는 그대로 작동하지만,
    // 우리가 원하는 경로에서만 추가로 커스텀 이벤트를 기록합니다
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  // Analytics 컴포넌트를 렌더링하여 실시간 기능 활성화
  // 자동 pageview는 그대로 작동하지만, 이벤트 수를 줄이기 위해
  // 우리가 trackPageView()로 추가 커스텀 이벤트를 기록합니다
  return <Analytics />;
}

