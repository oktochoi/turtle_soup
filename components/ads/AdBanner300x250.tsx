'use client';

import { useEffect, useRef } from 'react';
import { useAdSlot } from '@/hooks/useAdSlot';
import { adConfig, isAdsEnabled } from './adConfig';

interface AdBanner300x250Props {
  /**
   * 광고 위치 식별자 (로깅/분석용)
   */
  position?: string;
  
  /**
   * 추가 클래스명
   */
  className?: string;
  
  /**
   * 광고 로딩 실패 시 표시할 fallback 컴포넌트
   */
  fallback?: React.ReactNode;
}

/**
 * 300x250 배너 광고 컴포넌트
 * 모바일 UX를 위해 한 페이지당 최대 1개만 사용 권장
 */
export default function AdBanner300x250({
  position = 'default',
  className = '',
  fallback,
}: AdBanner300x250Props) {
  const scriptLoadedRef = useRef(false);
  const { containerRef, isLoaded, hasError, loadAd } = useAdSlot({
    useIntersectionObserver: adConfig.loadingStrategy.useIntersectionObserver,
    intersectionDelay: adConfig.loadingStrategy.intersectionDelay,
    showFallback: true,
    onError: (error) => {
      console.warn(`[AdBanner300x250:${position}] 광고 로딩 실패:`, error);
    },
  });

  // 광고 스크립트 로딩
  useEffect(() => {
    if (!isAdsEnabled() || !adConfig.banner300x250.enabled) {
      console.warn('[AdBanner300x250] 광고 비활성화:', {
        isAdsEnabled: isAdsEnabled(),
        bannerEnabled: adConfig.banner300x250.enabled,
        envVar: process.env.NEXT_PUBLIC_ADS_ENABLED,
      });
      return;
    }
    if (!isLoaded || scriptLoadedRef.current) {
      if (!isLoaded) {
        console.log('[AdBanner300x250] 뷰포트 진입 대기 중, isLoaded:', isLoaded);
      }
      return;
    }

    // 스크립트가 이미 로드되었는지 확인
    const existingScript = document.querySelector(
      `script[src="${adConfig.banner300x250.scriptUrl}"]`
    );
    
    if (existingScript) {
      scriptLoadedRef.current = true;
      return;
    }

    // atOptions 설정 (스크립트가 로드되기 전에 설정)
    // 전역 atOptions를 설정하여 스크립트가 이를 읽을 수 있도록 함
    if (!(window as any).atOptions) {
      (window as any).atOptions = {};
    }
    (window as any).atOptions = {
      key: adConfig.banner300x250.key,
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    };

    // 컨테이너가 DOM에 있는지 확인
    const containerId = `ad-banner-300x250-${position}`;
    const adContainer = document.getElementById(containerId);
    if (!adContainer) {
      console.warn(`[AdBanner300x250:${position}] 컨테이너를 찾을 수 없습니다: ${containerId}`);
      return;
    }

    // 스크립트 로딩
    const script = document.createElement('script');
    script.src = adConfig.banner300x250.scriptUrl;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.onload = () => {
      console.log(`[AdBanner300x250:${position}] 스크립트 로드 완료`);
      // 스크립트가 로드된 후 약간의 지연을 두고 광고 삽입 확인
      setTimeout(() => {
        const container = document.getElementById(containerId);
        if (container && container.children.length === 0) {
          console.warn(`[AdBanner300x250:${position}] 광고가 삽입되지 않았습니다. 컨테이너 ID: ${containerId}`);
          // 스크립트가 자동으로 삽입하지 않으면 수동으로 트리거 시도
          if ((window as any).atOptions && (window as any).atOptions.key === adConfig.banner300x250.key) {
            console.log(`[AdBanner300x250:${position}] atOptions 설정 확인됨, 광고 삽입 대기 중...`);
          }
        } else if (container && container.children.length > 0) {
          console.log(`[AdBanner300x250:${position}] 광고 삽입 확인됨 (${container.children.length}개 요소)`);
        } else {
          console.warn(`[AdBanner300x250:${position}] 컨테이너를 찾을 수 없음: ${containerId}`);
        }
      }, 2000);
    };
    script.onerror = () => {
      console.warn(`[AdBanner300x250:${position}] 스크립트 로딩 실패`);
    };
    
    document.head.appendChild(script);
    scriptLoadedRef.current = true;
  }, [isLoaded, position]);

  // 디버깅: 환경 변수 확인 (프로덕션에서도 로그 출력)
  useEffect(() => {
    console.log('[AdBanner300x250] 광고 상태:', {
      isAdsEnabled: isAdsEnabled(),
      bannerEnabled: adConfig.banner300x250.enabled,
      envVar: process.env.NEXT_PUBLIC_ADS_ENABLED,
      bannerEnvVar: process.env.NEXT_PUBLIC_BANNER_300X250_ENABLED,
      isLoaded,
      hasError,
      nodeEnv: process.env.NODE_ENV,
    });
  }, [isLoaded, hasError]);

  if (!isAdsEnabled() || !adConfig.banner300x250.enabled) {
    console.warn('[AdBanner300x250] 광고 비활성화:', {
      isAdsEnabled: isAdsEnabled(),
      bannerEnabled: adConfig.banner300x250.enabled,
      envVar: process.env.NEXT_PUBLIC_ADS_ENABLED,
    });
    return null;
  }

  // Fallback UI
  const defaultFallback = (
    <div className="flex items-center justify-center bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 text-sm py-8">
      <span>광고</span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`ad-banner-300x250 ${className}`}
      data-ad-position={position}
      style={{
        minHeight: hasError ? 'auto' : '250px',
        width: '100%',
        maxWidth: '300px',
        margin: '0 auto',
      }}
    >
      {hasError ? (
        <div className="ad-fallback">
          {fallback || defaultFallback}
        </div>
      ) : (
        <div
          id={`ad-banner-300x250-${position}`}
          style={{
            width: '100%',
            maxWidth: '300px',
            margin: '0 auto',
            minHeight: '250px',
          }}
        />
      )}
    </div>
  );
}

