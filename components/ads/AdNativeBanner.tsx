'use client';

import { useEffect, useRef } from 'react';
import { useAdSlot } from '@/hooks/useAdSlot';
import { adConfig, isAdsEnabled, isMobile } from './adConfig';

interface AdNativeBannerProps {
  /**
   * 광고 위치 식별자 (로깅/분석용)
   */
  position?: string;
  
  /**
   * 추가 클래스명
   */
  className?: string;
  
  /**
   * 모바일에서 4:1 비율 강제 여부
   * @default true
   */
  forceMobileAspectRatio?: boolean;
  
  /**
   * 추천 콘텐츠 카드처럼 보이도록 스타일링
   * @default true
   */
  cardStyle?: boolean;
  
  /**
   * 광고 로딩 실패 시 표시할 fallback 컴포넌트
   */
  fallback?: React.ReactNode;
}

/**
 * 네이티브 배너 광고 컴포넌트
 * 모바일에서는 4:1 비율로 자연스럽게 콘텐츠 카드처럼 표시
 */
export default function AdNativeBanner({
  position = 'default',
  className = '',
  forceMobileAspectRatio = true,
  cardStyle = true,
  fallback,
}: AdNativeBannerProps) {
  const scriptLoadedRef = useRef(false);
  const containerElementRef = useRef<HTMLDivElement | null>(null);
  const mobile = isMobile();
  
  const { containerRef, isLoaded, hasError, loadAd } = useAdSlot({
    useIntersectionObserver: adConfig.loadingStrategy.useIntersectionObserver,
    intersectionDelay: adConfig.loadingStrategy.intersectionDelay,
    showFallback: true,
    onError: (error) => {
      console.warn(`[AdNativeBanner:${position}] 광고 로딩 실패:`, error);
    },
  });

  // 광고 스크립트 로딩
  useEffect(() => {
    if (!isAdsEnabled() || !adConfig.nativeBanner.enabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AdNativeBanner] 광고 비활성화 상태:', {
          isAdsEnabled: isAdsEnabled(),
          nativeBannerEnabled: adConfig.nativeBanner.enabled,
        });
      }
      return;
    }
    if (!isLoaded || scriptLoadedRef.current) {
      if (process.env.NODE_ENV === 'development' && !isLoaded) {
        console.log('[AdNativeBanner] 아직 로딩되지 않음, isLoaded:', isLoaded);
      }
      return;
    }

    // 스크립트가 이미 로드되었는지 확인
    const existingScript = document.querySelector(
      `script[src="${adConfig.nativeBanner.scriptUrl}"]`
    );
    
    if (existingScript) {
      scriptLoadedRef.current = true;
      // 컨테이너가 이미 있으면 스크립트가 자동으로 처리할 것
      return;
    }

    // 스크립트 로딩
    const script = document.createElement('script');
    script.src = adConfig.nativeBanner.scriptUrl;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.onload = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AdNativeBanner:${position}] 스크립트 로드 완료`);
      }
      // 스크립트가 로드된 후 약간의 지연을 두고 광고 삽입 확인
      setTimeout(() => {
        const adContainer = document.getElementById(adConfig.nativeBanner.containerId);
        if (adContainer && adContainer.children.length === 0) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[AdNativeBanner:${position}] 광고가 삽입되지 않았습니다. 컨테이너 ID: ${adConfig.nativeBanner.containerId}`);
          }
        } else if (adContainer) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[AdNativeBanner:${position}] 광고 삽입 확인됨`);
          }
        }
      }, 1000);
    };
    script.onerror = () => {
      console.warn(`[AdNativeBanner:${position}] 스크립트 로딩 실패`);
    };
    
    document.head.appendChild(script);
    scriptLoadedRef.current = true;
  }, [isLoaded, position]);

  // 컨테이너 요소 참조 설정
  useEffect(() => {
    if (containerRef.current && !containerElementRef.current) {
      const container = containerRef.current.querySelector(
        `#${adConfig.nativeBanner.containerId}`
      ) as HTMLDivElement;
      if (container) {
        containerElementRef.current = container;
      }
    }
  }, [isLoaded]);

  // 디버깅: 환경 변수 확인
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AdNativeBanner] 디버그 정보:', {
        isAdsEnabled: isAdsEnabled(),
        nativeBannerEnabled: adConfig.nativeBanner.enabled,
        envVar: process.env.NEXT_PUBLIC_ADS_ENABLED,
        nativeBannerEnvVar: process.env.NEXT_PUBLIC_NATIVEBANNER_ENABLED,
      });
    }
  }, []);

  if (!isAdsEnabled() || !adConfig.nativeBanner.enabled) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[AdNativeBanner] 광고 비활성화:', {
        isAdsEnabled: isAdsEnabled(),
        nativeBannerEnabled: adConfig.nativeBanner.enabled,
      });
    }
    return null;
  }

  // Fallback UI (추천 콘텐츠 카드 스타일)
  const defaultFallback = (
    <div
      className={`${
        cardStyle
          ? 'bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:bg-slate-800/70 transition-colors'
          : 'bg-slate-800/50 border border-slate-700 rounded-lg'
      }`}
      style={{
        minHeight: mobile && forceMobileAspectRatio ? '60px' : 'auto',
        aspectRatio: mobile && forceMobileAspectRatio ? '4/1' : undefined,
      }}
    >
      <div className="flex items-center justify-center text-slate-500 text-sm py-4">
        <span>광고</span>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`ad-native-banner ${className}`}
      data-ad-position={position}
      style={{
        width: '100%',
        margin: '0 auto',
        minHeight: mobile && forceMobileAspectRatio ? '60px' : 'auto',
      }}
    >
      {hasError ? (
        <div className="ad-fallback">
          {fallback || defaultFallback}
        </div>
      ) : (
        <div
          id={adConfig.nativeBanner.containerId}
          className={cardStyle ? 'ad-native-container' : ''}
          style={{
            width: '100%',
            minHeight: mobile && forceMobileAspectRatio ? '60px' : 'auto',
            aspectRatio: mobile && forceMobileAspectRatio ? '4/1' : undefined,
          }}
        />
      )}
    </div>
  );
}

