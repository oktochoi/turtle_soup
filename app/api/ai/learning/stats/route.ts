import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';

/**
 * AI 학습 통계 조회
 * GET /api/ai/learning/stats?days=7
 * 관리자 전용
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');

    // 최근 N일간의 통계 조회
    const { data, error } = await supabase
      .from('ai_learning_stats')
      .select('*')
      .gte('stat_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('stat_date', { ascending: false });

    if (error) {
      console.error('통계 조회 오류:', error);
      return NextResponse.json(
        { error: '통계 조회에 실패했습니다.', details: error.message },
        { status: 500 }
      );
    }

    // 전체 통계 요약
    const summary = {
      total_bug_reports: data?.reduce((sum, stat) => sum + (stat.total_bug_reports || 0), 0) || 0,
      total_patterns_discovered: data?.reduce((sum, stat) => sum + (stat.patterns_discovered || 0), 0) || 0,
      total_patterns_applied: data?.reduce((sum, stat) => sum + (stat.patterns_applied || 0), 0) || 0,
      avg_confidence: data?.length 
        ? data.reduce((sum, stat) => sum + (stat.avg_confidence || 0), 0) / data.length 
        : 0,
    };

    return NextResponse.json({
      success: true,
      stats: data || [],
      summary,
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

