import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * 전체 AI 학습 사이클 실행 (분석 + 적용 + 통계 업데이트)
 * POST /api/ai/learning/cycle
 * 관리자 전용
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    
    // 전체 학습 사이클 실행
    const { data, error } = await supabase.rpc('run_ai_learning_cycle');

    if (error) {
      console.error('학습 사이클 오류:', error);
      return NextResponse.json(
        { error: '학습 사이클 실행에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ...data,
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

