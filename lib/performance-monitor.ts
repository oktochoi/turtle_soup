/**
 * 성능 모니터링 유틸리티
 * Pro 플랜에서 성능 메트릭 수집 및 분석
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
// Web Vitals 메트릭 타입
export interface WebVitalsMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

// 성능 메트릭 수집
export function reportWebVitals(metric: WebVitalsMetric) {
  // Vercel Speed Insights가 자동으로 수집하지만,
  // 추가 분석을 위해 커스텀 이벤트로도 전송 가능
  
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.value),
      metric_id: metric.id,
      metric_value: metric.value,
      metric_delta: metric.delta,
      metric_rating: metric.rating,
    });
  }

  // 개발 환경에서만 콘솔 출력
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: metric.rating,
    });
  }
}

// 페이지 로드 시간 측정
export function measurePageLoad() {
  if (typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
    const firstPaint = perfData.responseEnd - perfData.navigationStart;

    if (process.env.NODE_ENV === 'development') {
      console.log('[Performance]', {
        pageLoadTime: `${pageLoadTime}ms`,
        domContentLoaded: `${domContentLoaded}ms`,
        firstPaint: `${firstPaint}ms`,
      });
    }
  });
}

// API 응답 시간 측정 헬퍼
export async function measureApiCall<T>(
  apiCall: () => Promise<T>,
  endpoint: string
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await apiCall();
    const duration = performance.now() - startTime;
    
    // 느린 API 호출 경고 (1초 이상)
    if (duration > 1000 && process.env.NODE_ENV === 'development') {
      console.warn(`[Slow API] ${endpoint}: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[API Error] ${endpoint} (${duration.toFixed(2)}ms):`, error);
    throw error;
  }
}

// 메모리 사용량 모니터링 (선택사항)
export function monitorMemoryUsage() {
  if (typeof window === 'undefined' || !(performance as any).memory) return;

  const memory = (performance as any).memory;
  
  setInterval(() => {
    const used = memory.usedJSHeapSize / 1048576; // MB
    const total = memory.totalJSHeapSize / 1048576; // MB
    const limit = memory.jsHeapSizeLimit / 1048576; // MB

    if (used > limit * 0.8 && process.env.NODE_ENV === 'development') {
      console.warn('[Memory Warning]', {
        used: `${used.toFixed(2)}MB`,
        total: `${total.toFixed(2)}MB`,
        limit: `${limit.toFixed(2)}MB`,
        percentage: `${((used / limit) * 100).toFixed(2)}%`,
      });
    }
  }, 30000); // 30초마다 체크
}

