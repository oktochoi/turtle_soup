import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';

export async function POST() {
  try {
    // 관리자만 접근 가능
    const { supabase } = await requireAdmin();
    
    // 1시간 이상 활동이 없는 방을 자동으로 제거하는 함수 호출
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
    });
  } catch (error: any) {
    console.error('방 정리 API 오류:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET 요청도 허용 (간단한 호출용)
export async function GET() {
  return POST();
}

