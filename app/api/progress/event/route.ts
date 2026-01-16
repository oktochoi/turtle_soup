import { NextRequest, NextResponse } from 'next/server';
import { applyEvent, getOrCreateUserByGuestId, getOrCreateUserByAuthId } from '@/lib/progress';
import type { XPEventType, EventPayload } from '@/types/progress';
import { createClient } from '@/lib/supabase/server';
import { validateQuestionOrGuess } from '@/lib/input-validation';

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting 체크 (선택사항)
    const body = await request.json();
    const { 
      userId, 
      guestId, 
      authUserId,
      eventType, 
      payload = {} 
    }: {
      userId?: string;
      guestId?: string;
      authUserId?: string;
      eventType: XPEventType;
      payload?: EventPayload;
    } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType이 필요합니다.' },
        { status: 400 }
      );
    }

    let finalUserId = userId;

    // userId가 없으면 guestId 또는 authUserId로 유저 찾기/생성
    if (!finalUserId) {
      if (authUserId) {
        const user = await getOrCreateUserByAuthId(authUserId);
        if (!user) {
          return NextResponse.json(
            { error: '유저를 생성할 수 없습니다.' },
            { status: 500 }
          );
        }
        finalUserId = user.id;
      } else if (guestId) {
        const user = await getOrCreateUserByGuestId(guestId);
        if (!user) {
          return NextResponse.json(
            { error: '유저를 생성할 수 없습니다.' },
            { status: 500 }
          );
        }
        finalUserId = user.id;
      } else {
        return NextResponse.json(
          { error: 'userId, guestId, 또는 authUserId 중 하나가 필요합니다.' },
          { status: 400 }
        );
      }
    }

    if (!finalUserId) {
      return NextResponse.json(
        { error: '유효한 userId를 찾을 수 없습니다.' },
        { status: 400 }
      );
    }

    // 이벤트 적용
    const result = await applyEvent(finalUserId, eventType, payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '이벤트 처리에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      userId: finalUserId,
      ...result,
    });
  } catch (error: any) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

