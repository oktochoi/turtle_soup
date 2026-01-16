import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job: AI 학습 큐 처리
 * 이 엔드포인트는 Vercel Cron Jobs에서 주기적으로 호출됩니다.
 * 
 * 우선 Edge Function을 호출하고, 실패하면 직접 처리합니다.
 * 설정: vercel.json에 cron job 추가 필요
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cron Secret 확인 (보안)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    // 먼저 Edge Function 호출 시도
    try {
      const edgeFunctionResponse = await fetch(
        `${supabaseUrl}/functions/v1/process-ai-learning`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (edgeFunctionResponse.ok) {
        const data = await edgeFunctionResponse.json();
        return NextResponse.json({
          success: true,
          ...data,
          source: 'edge-function',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (edgeError) {
      console.log('Edge Function 호출 실패, 직접 처리로 전환:', edgeError);
    }

    // Edge Function이 없거나 실패한 경우 직접 처리
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const batchSize = 10;

    // 1. 큐에서 다음 작업 가져오기
    const { data: jobs, error: fetchError } = await supabase.rpc(
      'get_next_learning_job',
      { batch_size: batchSize }
    );

    if (fetchError) {
      console.error('작업 가져오기 오류:', fetchError);
      return NextResponse.json(
        { error: '작업 가져오기 실패', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: '처리할 작업이 없습니다.',
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📦 ${jobs.length}개의 작업을 처리합니다.`);

    // 2. 모든 작업을 'processing'으로 업데이트
    const jobIds = jobs.map((j: any) => j.id);
    for (const jobId of jobIds) {
      await supabase.rpc('update_learning_job_status', {
        job_id: jobId,
        new_status: 'processing',
      });
    }

    // 3. AI 학습 패턴 분석 실행
    const minReports = 5;
    const lookbackDays = 30;

    const { data: patterns, error: analyzeError } = await supabase.rpc(
      'analyze_bug_reports_for_learning',
      {
        min_reports: minReports,
        lookback_days: lookbackDays,
      }
    );

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
      patterns_found: 0,
    };

    if (analyzeError) {
      // 모든 작업을 실패로 표시
      for (const jobId of jobIds) {
        await supabase.rpc('update_learning_job_status', {
          job_id: jobId,
          new_status: 'failed',
          error_msg: `패턴 분석 오류: ${analyzeError.message}`,
        });
      }
      results.failed = jobIds.length;
      results.errors.push(`패턴 분석 오류: ${analyzeError.message}`);
    } else {
      // 패턴이 발견되면 ai_learning_patterns에 저장
      if (patterns && patterns.length > 0) {
        for (const pattern of patterns) {
          try {
            // 기존 패턴 확인
            const { data: existing } = await supabase
              .from('ai_learning_patterns')
              .select('id')
              .eq('pattern_type', pattern.pattern_type)
              .eq('pattern_data', JSON.stringify(pattern.pattern_data))
              .maybeSingle();

            if (!existing) {
              // 새 패턴 저장
              const { error: insertError } = await supabase
                .from('ai_learning_patterns')
                .insert({
                  pattern_type: pattern.pattern_type,
                  pattern_data: pattern.pattern_data,
                  confidence_score: pattern.confidence,
                  bug_report_count: pattern.report_count,
                  applied: false,
                });

              if (insertError) {
                console.error('패턴 저장 오류:', insertError);
                results.errors.push(`패턴 저장 오류: ${insertError.message}`);
              } else {
                results.patterns_found++;
                console.log(`✅ 새 패턴 저장: ${pattern.pattern_type}`);
              }
            }
          } catch (error: any) {
            console.error('패턴 처리 오류:', error);
            results.errors.push(`패턴 처리 오류: ${error.message}`);
          }
        }
      }

      // 모든 작업을 완료로 표시
      for (const jobId of jobIds) {
        await supabase.rpc('update_learning_job_status', {
          job_id: jobId,
          new_status: 'completed',
        });
      }
      results.processed = jobIds.length;
    }

    // 4. 통계 업데이트
    try {
      await supabase.rpc('update_ai_learning_stats');
    } catch (statsError) {
      console.error('통계 업데이트 오류:', statsError);
    }

    // 5. 학습된 리포트를 studied로 표시
    if (results.processed > 0) {
      try {
        const { error: markError } = await supabase.rpc('mark_reports_as_studied');
        if (markError) {
          console.error('학습 리포트 표시 오류:', markError);
        }
      } catch (error) {
        console.error('학습 리포트 표시 오류:', error);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `${results.processed}개 처리 완료, ${results.failed}개 실패, ${results.patterns_found}개 패턴 발견`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron Job 오류:', error);
    return NextResponse.json(
      { error: '서버 오류', details: error.message },
      { status: 500 }
    );
  }
}

