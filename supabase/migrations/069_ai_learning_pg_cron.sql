-- AI 학습 사이클을 pg_cron으로 실행 (Edge/Serverless 부하 분리)
-- Vercel Cron 대신 Supabase에서 직접 처리 가능

-- 전체 사이클 래퍼 함수
CREATE OR REPLACE FUNCTION run_ai_learning_cycle(p_batch_size INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_job_ids UUID[] := '{}';
  v_pattern RECORD;
  v_patterns_found INTEGER := 0;
  v_processed INTEGER := 0;
  v_min_reports INTEGER := 5;
  v_lookback_days INTEGER := 30;
  v_start_time TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 1. 큐에서 다음 작업 가져오기
  FOR v_job IN SELECT * FROM get_next_learning_job(p_batch_size)
  LOOP
    v_job_ids := array_append(v_job_ids, v_job.id);
  END LOOP;

  IF array_length(v_job_ids, 1) IS NULL OR array_length(v_job_ids, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'processed', 0,
      'patterns_found', 0,
      'batch_size', p_batch_size,
      'processing_time_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
      'message', '처리할 작업이 없습니다.'
    );
  END IF;

  -- 2. processing으로 업데이트
  FOR i IN 1..array_length(v_job_ids, 1) LOOP
    PERFORM update_learning_job_status(v_job_ids[i], 'processing', NULL);
  END LOOP;

  -- 3. 패턴 분석 및 저장
  FOR v_pattern IN SELECT * FROM analyze_bug_reports_for_learning(v_min_reports, v_lookback_days)
  LOOP
    INSERT INTO ai_learning_patterns (pattern_type, pattern_data, confidence_score, bug_report_count, applied)
    SELECT v_pattern.pattern_type, v_pattern.pattern_data, v_pattern.confidence, v_pattern.report_count::INTEGER, false
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_learning_patterns alp
      WHERE alp.pattern_type = v_pattern.pattern_type AND alp.pattern_data = v_pattern.pattern_data
    );
    IF FOUND THEN
      v_patterns_found := v_patterns_found + 1;
    END IF;
  END LOOP;

  -- 4. 작업 완료 처리
  FOR i IN 1..array_length(v_job_ids, 1) LOOP
    PERFORM update_learning_job_status(v_job_ids[i], 'completed', NULL);
  END LOOP;
  v_processed := array_length(v_job_ids, 1);

  -- 5. 통계 업데이트
  PERFORM update_ai_learning_stats();

  -- 6. studied 표시
  PERFORM mark_reports_as_studied();

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'patterns_found', v_patterns_found,
    'batch_size', p_batch_size,
    'processing_time_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
    'message', format('%s개 처리 완료, %s개 패턴 발견', v_processed, v_patterns_found)
  );
EXCEPTION WHEN OTHERS THEN
  IF array_length(v_job_ids, 1) > 0 THEN
    FOR i IN 1..array_length(v_job_ids, 1) LOOP
      PERFORM update_learning_job_status(v_job_ids[i], 'failed', SQLERRM);
    END LOOP;
  END IF;
  RAISE;
END;
$$;

COMMENT ON FUNCTION run_ai_learning_cycle(INTEGER) IS 
  'AI 학습 전체 사이클. pg_cron에서 호출하여 Edge/Serverless 부하 분리.';

GRANT EXECUTE ON FUNCTION run_ai_learning_cycle(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION run_ai_learning_cycle(INTEGER) TO authenticated;

-- pg_cron 스케줄 (Supabase 대시보드 → Database → Extensions → pg_cron 활성화 후 SQL Editor에서 실행):
-- SELECT cron.schedule('ai-learning-cycle', '*/10 * * * *', $$SELECT run_ai_learning_cycle(50)$$);
