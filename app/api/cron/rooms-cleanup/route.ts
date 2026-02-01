import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job: 비활성 방 자동 삭제
 * 30분 이상 활동이 없는 방(바다거북스프/라이어/마피아)을 자동으로 삭제합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('cleanup_inactive_rooms');
    
    if (error) {
      console.error('방 정리 오류:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup rooms', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      deletedCount: data || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('방 정리 Cron 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
