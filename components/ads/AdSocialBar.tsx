'use client';

import { useEffect, useRef, useState } from 'react';
import { useAdSlot, useAdSessionLimit } from '@/hooks/useAdSlot';
import { adConfig, isAdsEnabled, isMobile } from './adConfig';

interface AdSocialBarProps {
  /**
   * 광고 위치 식별자 (로깅/분석용)
   */
  position?: string;
  
  /**
   * 추가 클래스명
   */
  className?: string;
  
  /**
   * 닫기 버튼 표시 여부
   * @default true
   */
  showCloseButton?: boolean;
  
  /**
   * 모바일에서만 표시
   * @default false
   */
  mobileOnly?: boolean;
}

/**
 * 소셜 바 광고 컴포넌트
 * 세션당 최대 1회만 표시, 닫기 가능
 */
export default function AdSocialBar({
  position = 'default',
  className = '',
  showCloseButton = true,
  mobileOnly = false,
}: AdSocialBarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const scriptLoadedRef = useRef(false);
  const mobile = isMobile();
  
  const { canShow, markAsShown } = useAdSessionLimit(
    'social-bar',
    adConfig.socialBar.maxPerSession
  );

  const { containerRef, isLoaded, hasError, loadAd } = useAdSlot({
    useIntersectionObserver: adConfig.loadingStrategy.useIntersectionObserver,
    intersectionDelay: adConfig.loadingStrategy.intersectionDelay,
    showFallback: false,
    onLoad: () => {
      if (canShow && !isClosed) {
        setIsVisible(true);
        markAsShown();
      }
    },
    onError: (error) => {
      console.warn(`[AdSocialBar:${position}] 광고 로딩 실패:`, error);
    },
  });

  // 모바일 전용 체크
  useEffect(() => {
    if (mobileOnly && !mobile) {
      setIsClosed(true);
    }
  }, [mobileOnly, mobile]);

  // 광고 스크립트 로딩
  useEffect(() => {
    if (!isAdsEnabled() || !adConfig.socialBar.enabled) return;
    if (!isLoaded || scriptLoadedRef.current) return;
    if (!canShow || isClosed) return;

    // 스크립트가 이미 로드되었는지 확인
    const existingScript = document.querySelector(
      `script[src="${adConfig.socialBar.scriptUrl}"]`
    );
    
    if (existingScript) {
      scriptLoadedRef.current = true;
      return;
    }

    // 컨테이너가 DOM에 있는지 확인
    const containerId = `ad-social-bar-${position}`;
    const adContainer = document.getElementById(containerId);
    if (!adContainer) {
      console.warn(`[AdSocialBar:${position}] 컨테이너를 찾을 수 없습니다: ${containerId}`);
      // 컨테이너가 없어도 스크립트는 로드 (스크립트가 자동으로 찾을 수 있음)
    }

    // 스크립트 로딩
    const script = document.createElement('script');
    script.src = adConfig.socialBar.scriptUrl;
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.onload = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AdSocialBar:${position}] 스크립트 로드 완료, 컨테이너 ID: ${containerId}`);
      }
      // 스크립트가 로드된 후 약간의 지연을 두고 광고 삽입 확인
      setTimeout(() => {
        const container = document.getElementById(containerId);
        if (container && container.children.length === 0) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[AdSocialBar:${position}] 광고가 삽입되지 않았습니다. 컨테이너 ID: ${containerId}`);
          }
        } else if (container && container.children.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[AdSocialBar:${position}] 광고 삽입 확인됨`);
          }
        }
      }, 2000);
    };
    script.onerror = () => {
      console.warn(`[AdSocialBar:${position}] 스크립트 로딩 실패`);
    };
    
    document.body.appendChild(script);
    scriptLoadedRef.current = true;
  }, [isLoaded, canShow, isClosed, position]);

  const handleClose = () => {
    setIsClosed(true);
    setIsVisible(false);
  };

  if (!isAdsEnabled() || !adConfig.socialBar.enabled) {
    return null;
  }

  if (!canShow || isClosed || hasError) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`ad-social-bar ${className} ${
        isVisible ? 'block' : 'hidden'
      }`}
      data-ad-position={position}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50, // 다른 UI보다 낮게 (헤더/푸터는 보통 100 이상)
        maxHeight: mobile ? '80px' : '100px',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      {showCloseButton && (
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 z-[60] bg-slate-900/80 hover:bg-slate-800 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
          aria-label="닫기"
          style={{
            zIndex: 60,
          }}
        >
          ×
        </button>
      )}
      <div 
        id={`ad-social-bar-${position}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      />
    </div>
  );
}

