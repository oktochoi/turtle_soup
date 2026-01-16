/**
 * 광고 설정 및 환경 변수 관리
 */

export const adConfig = {
  // 광고 활성화 여부
  // 개발 환경에서는 기본적으로 활성화 (환경 변수가 없어도)
  enabled: process.env.NEXT_PUBLIC_ADS_ENABLED !== 'false' && 
           (process.env.NEXT_PUBLIC_ADS_ENABLED === 'true' || process.env.NODE_ENV === 'development'),
  
  // 개별 광고 타입 활성화
  popunder: {
    enabled: process.env.NEXT_PUBLIC_POPUNDER_ENABLED === 'true',
    // 모바일에서는 항상 비활성화
    allowMobile: false,
  },
  
  smartlink: {
    enabled: process.env.NEXT_PUBLIC_SMARTLINK_ENABLED === 'true',
    url: 'https://www.effectivegatecpm.com/m1a1pe7afg?key=ec322f72f792efd9e81883e8e3258e8b',
  },
  
  socialBar: {
    enabled: process.env.NEXT_PUBLIC_SOCIALBAR_ENABLED === 'true',
    scriptUrl: 'https://pl28489651.effectivegatecpm.com/03/8a/81/038a81177705a94b1b3a016e57699e3f.js',
    // 세션당 최대 표시 횟수
    maxPerSession: 1,
  },
  
  nativeBanner: {
    enabled: process.env.NEXT_PUBLIC_NATIVEBANNER_ENABLED !== 'false' && 
             (process.env.NEXT_PUBLIC_NATIVEBANNER_ENABLED === 'true' || process.env.NODE_ENV === 'development'),
    scriptUrl: 'https://pl28489713.effectivegatecpm.com/e55815afb3e5d73fa76db3038a7eff13/invoke.js',
    containerId: 'container-e55815afb3e5d73fa76db3038a7eff13',
    // 모바일에서 권장 비율 (4:1)
    mobileAspectRatio: '4:1',
  },
  
  banner300x250: {
    enabled: process.env.NEXT_PUBLIC_BANNER_300X250_ENABLED !== 'false',
    key: 'af92c18ee1c46169b735a94109cbf875',
    scriptUrl: 'https://www.highperformanceformat.com/af92c18ee1c46169b735a94109cbf875/invoke.js',
    width: 300,
    height: 250,
  },
  
  popunderScript: {
    enabled: process.env.NEXT_PUBLIC_POPUNDER_ENABLED === 'true',
    scriptUrl: 'https://pl28493943.effectivegatecpm.com/4e/aa/53/4eaa533e8af316dc8287bf5ab5a27d46.js',
  },
  
  // 페이지당 최대 광고 개수
  maxAdsPerPage: 2,
  
  // 광고 로딩 전략
  loadingStrategy: {
    // 뷰포트 진입 시 로딩 (IntersectionObserver)
    // 개발 환경에서는 즉시 로딩
    useIntersectionObserver: process.env.NODE_ENV !== 'development',
    // 뷰포트 진입 전 대기 시간 (ms)
    intersectionDelay: 100,
  },
} as const;

/**
 * 모바일 기기 감지
 */
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

/**
 * 데스크톱 기기 감지
 */
export const isDesktop = (): boolean => {
  return !isMobile();
};

/**
 * Popunder가 허용되는지 확인
 */
export const canShowPopunder = (): boolean => {
  if (!adConfig.popunder.enabled) return false;
  if (isMobile() && !adConfig.popunder.allowMobile) return false;
  return true;
};

/**
 * 광고가 활성화되어 있는지 확인
 */
export const isAdsEnabled = (): boolean => {
  return adConfig.enabled;
};

