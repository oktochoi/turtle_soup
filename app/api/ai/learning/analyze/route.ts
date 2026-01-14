import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 버그 리포트를 분석하여 학습 패턴 추출
 * GET /api/ai/learning/analyze?min_reports=5&lookback_days=30
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const minReports = parseInt(searchParams.get('min_reports') || '5');
    const lookbackDays = parseInt(searchParams.get('lookback_days') || '30');

    // 버그 리포트 분석 함수 호출
    const { data, error } = await supabase.rpc('analyze_bug_reports_for_learning', {
      min_reports: minReports,
      lookback_days: lookbackDays,
    });

    if (error) {
      console.error('버그 리포트 분석 오류:', error);
      return NextResponse.json(
        { error: '버그 리포트 분석에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      patterns: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

