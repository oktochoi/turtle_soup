import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * 학습 패턴을 AI 로직에 적용
 * POST /api/ai/learning/apply
 * 관리자 전용
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    
    // 패턴 적용 함수 호출
    const { data, error } = await supabase.rpc('apply_learning_patterns');

    if (error) {
      console.error('패턴 적용 오류:', error);
      return NextResponse.json(
        { error: '패턴 적용에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      applied_count: data || 0,
    });
  } catch (error: any) {
    console.error('API 오류:', error);
    
    // 인증/권한 오류 처리
    if (error.message?.includes('Unauthorized') || error.message?.includes('Forbidden')) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message?.includes('Unauthorized') ? 401 : 403 }
      );
    }
    
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

