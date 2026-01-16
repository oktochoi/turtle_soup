'use client';

import { useEffect, useRef } from 'react';
import { adConfig, canShowPopunder, isAdsEnabled } from './adConfig';

interface PopunderLoaderProps {
  /**
   * 광고 위치 식별자 (로깅/분석용)
   */
  position?: string;
}

/**
 * Popunder 광고 로더
 * 모바일에서는 완전히 차단되며, 데스크톱에서만 조건부 로딩
 */
export default function PopunderLoader({
  position = 'default',
}: PopunderLoaderProps) {
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // 광고 비활성화 또는 Popunder 비활성화
    if (!isAdsEnabled() || !adConfig.popunderScript.enabled) {
      return;
    }

    // 모바일에서는 절대 실행하지 않음
    if (!canShowPopunder()) {
      return;
    }

    // 스크립트가 이미 로드되었는지 확인
    const existingScript = document.querySelector(
      `script[src="${adConfig.popunderScript.scriptUrl}"]`
    );
    
    if (existingScript || scriptLoadedRef.current) {
      return;
    }

    // 데스크톱에서만 스크립트 로딩
    // 사용자 상호작용 후에만 실행되도록 지연
    const loadScript = () => {
      if (scriptLoadedRef.current) return;

      const script = document.createElement('script');
      script.src = adConfig.popunderScript.scriptUrl;
      script.async = true;
      script.onerror = () => {
        console.warn(`[PopunderLoader:${position}] 스크립트 로딩 실패`);
      };
      
      document.body.appendChild(script);
      scriptLoadedRef.current = true;
    };

    // 사용자 상호작용(클릭) 후에만 로딩
    const handleUserInteraction = () => {
      loadScript();
      // 한 번만 실행
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // 최소 3초 후에만 활성화 (페이지 로드 직후 팝업 방지)
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleUserInteraction, { once: true });
      document.addEventListener('touchstart', handleUserInteraction, { once: true });
    }, 3000);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [position]);

  // Popunder는 UI를 렌더링하지 않음
  return null;
}

