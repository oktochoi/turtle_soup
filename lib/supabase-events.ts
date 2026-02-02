/**
 * Supabase events 테이블 이벤트 추적
 * 대시보드 통계용 - track_event RPC 호출
 */

import { supabase } from '@/lib/supabase';

type EventType =
  | 'view_problem'
  | 'click_cta_invite'
  | 'create_room'
  | 'join_room'
  | 'submit_question'
  | 'submit_guess';

export async function trackSupabaseEvent(
  eventType: EventType,
  options?: {
    category?: string;
    meta?: Record<string, unknown>;
    pagePath?: string;
    lang?: string;
  }
): Promise<void> {
  try {
    const pagePath =
      options?.pagePath ??
      (typeof window !== 'undefined' ? window.location.pathname : null);
    const userAgent =
      typeof navigator !== 'undefined' ? navigator.userAgent : null;

    await supabase.rpc('track_event', {
      p_event_type: eventType,
      p_event_category: options?.category ?? 'engagement',
      p_meta: options?.meta ?? {},
      p_page_path: pagePath,
      p_page_referrer:
        typeof document !== 'undefined' ? document.referrer || null : null,
      p_user_agent: userAgent,
      p_language: options?.lang ?? 'ko',
    });
  } catch (err) {
    // 이벤트 추적 실패는 앱 동작에 영향 없음
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase 이벤트 추적 실패:', err);
    }
  }
}
