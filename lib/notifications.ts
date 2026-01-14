// 알림 생성 유틸리티 함수
import { createClient } from '@/lib/supabase/client';

export async function createNotification(args: {
  userId: string;
  type: 'comment_on_problem' | 'comment_on_post' | 'reply_to_comment';
  title: string;
  message: string;
  link: string;
}): Promise<void> {
  try {
    // 서버 사이드에서 실행되어야 하므로, Edge Function이나 API Route를 통해 호출해야 합니다.
    // 클라이언트 사이드에서는 직접 호출하지 않고 API Route를 통해 호출합니다.
    const response = await fetch('/api/notifications/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '알림 생성 실패');
    }
  } catch (error) {
    console.error('알림 생성 오류:', error);
    // 알림 생성 실패는 치명적이지 않으므로 에러를 throw하지 않음
  }
}

