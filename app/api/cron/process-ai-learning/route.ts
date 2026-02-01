import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job: AI 학습 큐 처리 (트리거 전용)
 *
 * 무거운 AI/분석 작업은 Supabase PostgreSQL 내 run_ai_learning_cycle()에서 처리합니다.
 * 이 API는 단순히 RPC 호출만 하므로 Edge CPU 부하가 거의 없습니다.
 *
 * - AI_LEARNING_BATCH_SIZE: 배치 크기 (기본 50, 50~100 권장)
 * - pg_cron 사용 시: Supabase에서 직접 run_ai_learning_cycle 스케줄링 가능
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const batchSize = Math.min(
      Math.max(1, parseInt(process.env.AI_LEARNING_BATCH_SIZE ?? '50', 10) || 50),
      100
    );

    const { data, error } = await supabase.rpc('run_ai_learning_cycle', {
      p_batch_size: batchSize,
    });

    const processingTimeMs = Date.now() - startTime;

    if (error) {
      console.error('[AI-Learning] RPC 오류:', {
        batch_size: batchSize,
        processing_time_ms: processingTimeMs,
        error: error.message,
      });
      return NextResponse.json(
        {
          error: 'AI 학습 사이클 실패',
          details: error.message,
          batch_size: batchSize,
          processing_time_ms: processingTimeMs,
        },
        { status: 500 }
      );
    }

    const result = data as {
      success?: boolean;
      processed?: number;
      patterns_found?: number;
      batch_size?: number;
      processing_time_ms?: number;
      message?: string;
    };

    console.log('[AI-Learning] 완료:', {
      batch_size: result.batch_size ?? batchSize,
      processed: result.processed ?? 0,
      patterns_found: result.patterns_found ?? 0,
      processing_time_ms: result.processing_time_ms ?? processingTimeMs,
    });

    return NextResponse.json({
      success: true,
      ...result,
      processing_time_ms: result.processing_time_ms ?? processingTimeMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const processingTimeMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI-Learning] Cron 오류:', {
      processing_time_ms: processingTimeMs,
      error: message,
    });
    return NextResponse.json(
      {
        error: '서버 오류',
        details: message,
        processing_time_ms: processingTimeMs,
      },
      { status: 500 }
    );
  }
}

