/**
 * 앱 환경인지 확인 (User Agent로 판단)
 */
export function isApp(): boolean {
  if (typeof window === 'undefined') return false;
  return navigator.userAgent.includes('TurtleSoupApp');
}

