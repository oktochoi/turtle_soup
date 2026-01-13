// 클라이언트 사이드에서 사용하는 XP 이벤트 호출 헬퍼
import type { XPEventType, EventPayload, EventResult } from '@/types/progress';

/**
 * XP 이벤트를 서버에 전송하고 결과를 반환
 */
export async function triggerEvent(
  userId: string | null,
  guestId: string | null,
  authUserId: string | null,
  eventType: XPEventType,
  payload: EventPayload = {}
): Promise<EventResult | null> {
  try {
    const response = await fetch('/api/progress/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        guestId,
        authUserId,
        eventType,
        payload,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('이벤트 처리 오류:', error);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('이벤트 전송 오류:', error);
    return null;
  }
}

/**
 * 게스트 ID 생성 또는 가져오기 (localStorage 기반)
 */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') return '';

  const key = 'turtle_soup_guest_id';
  let guestId = localStorage.getItem(key);

  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(key, guestId);
  }

  return guestId;
}

