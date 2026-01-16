'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { isMobile } from '@/components/ads/adConfig';

/**
 * 광고 슬롯 로딩을 위한 커스텀 훅
 * IntersectionObserver를 사용하여 뷰포트 진입 시에만 광고를 로딩합니다.
 */
export interface UseAdSlotOptions {
  /**
   * IntersectionObserver 사용 여부
   * @default true
   */
  useIntersectionObserver?: boolean;
  
  /**
   * 뷰포트 진입 전 대기 시간 (ms)
   * @default 100
   */
  intersectionDelay?: number;
  
  /**
   * 광고 로딩 실패 시 fallback 표시 여부
   * @default true
   */
  showFallback?: boolean;
  
  /**
   * 광고 로딩 완료 콜백
   */
  onLoad?: () => void;
  
  /**
   * 광고 로딩 실패 콜백
   */
  onError?: (error: Error) => void;
}

export interface UseAdSlotReturn {
  /**
   * 광고 컨테이너 ref
   */
  containerRef: React.RefObject<HTMLDivElement | null>;
  
  /**
   * 광고가 로딩되었는지 여부
   */
  isLoaded: boolean;
  
  /**
   * 광고 로딩 실패 여부
   */
  hasError: boolean;
  
  /**
   * 광고를 수동으로 로딩하는 함수
   */
  loadAd: () => void;
}

/**
 * 광고 슬롯 로딩 훅
 */
export function useAdSlot(options: UseAdSlotOptions = {}): UseAdSlotReturn {
  const {
    useIntersectionObserver = true,
    intersectionDelay = 100,
    showFallback = true,
    onLoad,
    onError,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadAd = useCallback(() => {
    if (isLoaded || hasError) return;
    
    // 약간의 지연을 두어 레이아웃 안정화
    loadTimeoutRef.current = setTimeout(() => {
      setIsLoaded(true);
      onLoad?.();
    }, intersectionDelay);
  }, [isLoaded, hasError, intersectionDelay, onLoad]);

  useEffect(() => {
    if (!containerRef.current) return;

    // IntersectionObserver를 사용하지 않는 경우 즉시 로딩
    if (!useIntersectionObserver) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링되도록
      const timeout = setTimeout(() => {
        loadAd();
      }, 100);
      return () => clearTimeout(timeout);
    }

    // IntersectionObserver 설정
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoaded && !hasError) {
            loadAd();
            // 한 번 로딩되면 관찰 중지
            if (containerRef.current) {
              observer.unobserve(containerRef.current);
            }
          }
        });
      },
      {
        rootMargin: '50px', // 뷰포트 진입 50px 전에 미리 로딩
        threshold: 0.1,
      }
    );

    observer.observe(containerRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current && containerRef.current) {
        observerRef.current.unobserve(containerRef.current);
      }
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [useIntersectionObserver, isLoaded, hasError, loadAd]);

  // 에러 처리
  useEffect(() => {
    if (hasError && onError) {
      onError(new Error('광고 로딩 실패'));
    }
  }, [hasError, onError]);

  return {
    containerRef,
    isLoaded,
    hasError,
    loadAd,
  };
}

/**
 * 세션당 광고 표시 횟수를 관리하는 훅
 */
export function useAdSessionLimit(
  adType: string,
  maxPerSession: number = 1
): { canShow: boolean; markAsShown: () => void } {
  const [shownCount, setShownCount] = useState(0);

  useEffect(() => {
    // 세션 스토리지에서 이전 표시 횟수 확인
    const key = `ad_shown_${adType}`;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      setShownCount(parseInt(stored, 10));
    }
  }, [adType]);

  const markAsShown = useCallback(() => {
    const newCount = shownCount + 1;
    setShownCount(newCount);
    const key = `ad_shown_${adType}`;
    sessionStorage.setItem(key, newCount.toString());
  }, [adType, shownCount]);

  const canShow = shownCount < maxPerSession;

  return { canShow, markAsShown };
}

