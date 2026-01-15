-- 학습된 리포트 추적을 위한 studied 컬럼 추가

-- 1. studied 컬럼 추가
ALTER TABLE ai_bug_reports
ADD COLUMN IF NOT EXISTS studied BOOLEAN DEFAULT false NOT NULL;

-- 1-1. 기존 모든 리포트를 studied = true로 설정 (이미 처리된 것으로 간주)
UPDATE ai_bug_reports
SET studied = true
WHERE studied = false;

-- 2. 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_studied 
ON ai_bug_reports(studied) 
WHERE studied = false;

-- 3. 학습 실행 시 사용된 리포트를 studied = true로 설정하는 함수
CREATE OR REPLACE FUNCTION mark_reports_as_studied()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  marked_count INTEGER;
BEGIN
  -- 학습에 사용된 리포트 (pending 상태이고 ignore_for_learning = false)를 studied = true로 설정
  UPDATE ai_bug_reports
  SET studied = true
  WHERE status = 'pending'
    AND ignore_for_learning = false
    AND studied = false;
  
  GET DIAGNOSTICS marked_count = ROW_COUNT;
  
  RETURN marked_count;
END;
$$;

-- 4. run_ai_learning_cycle 함수 업데이트하여 학습 후 자동으로 studied = true 설정
CREATE OR REPLACE FUNCTION run_ai_learning_cycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patterns_found INTEGER;
  patterns_applied INTEGER;
  errors_synced INTEGER;
  reports_marked INTEGER;
  result JSONB;
BEGIN
  -- 1. 버그 리포트 분석하여 패턴 추출
  INSERT INTO ai_learning_patterns (pattern_type, pattern_data, confidence_score, bug_report_count)
  SELECT 
    pattern_type,
    pattern_data,
    confidence,
    report_count
  FROM analyze_bug_reports_for_learning(5, 30)
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS patterns_found = ROW_COUNT;
  
  -- 2. 패턴 적용
  SELECT apply_learning_patterns() INTO patterns_applied;
  
  -- 3. 적용된 패턴을 learned_errors에 동기화
  SELECT sync_learning_patterns_to_errors() INTO errors_synced;
  
  -- 4. 학습에 사용된 리포트를 studied = true로 표시
  SELECT mark_reports_as_studied() INTO reports_marked;
  
  -- 5. 통계 업데이트
  PERFORM update_ai_learning_stats();
  
  -- 6. 결과 반환
  result := jsonb_build_object(
    'success', true,
    'patterns_found', patterns_found,
    'patterns_applied', patterns_applied,
    'errors_synced', COALESCE(errors_synced, 0),
    'reports_marked', COALESCE(reports_marked, 0),
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- 5. 주석 추가
COMMENT ON COLUMN ai_bug_reports.studied IS 
'학습에 사용된 리포트인지 여부. true이면 이미 학습에 사용되어 UI에서 숨겨집니다.';

COMMENT ON FUNCTION mark_reports_as_studied IS 
'학습에 사용된 리포트를 studied = true로 표시합니다.';

