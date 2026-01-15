-- 버그 리포트 학습 제외 기능 추가
-- 삭제하지 않고 학습에서만 제외하는 방식으로 변경

-- 1. ignore_for_learning 컬럼 추가
ALTER TABLE ai_bug_reports
ADD COLUMN IF NOT EXISTS ignore_for_learning BOOLEAN DEFAULT false NOT NULL;

-- 2. 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_ignore_for_learning 
ON ai_bug_reports(ignore_for_learning) 
WHERE ignore_for_learning = false;

-- 3. AI 학습 함수에서 ignore_for_learning = false 필터 추가
CREATE OR REPLACE FUNCTION analyze_bug_reports_for_learning(
  min_reports INTEGER DEFAULT 5,
  lookback_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  pattern_type TEXT,
  pattern_data JSONB,
  confidence NUMERIC,
  report_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH recent_reports AS (
    SELECT *
    FROM ai_bug_reports
    WHERE created_at >= NOW() - (lookback_days || ' days')::INTERVAL
      AND status = 'pending'
      AND ignore_for_learning = false  -- 학습 제외된 리포트는 제외
  ),
  
  -- 1. Threshold 조정 패턴: 특정 유사도 범위에서 자주 틀리는 경우
  threshold_patterns AS (
    SELECT 
      'threshold_adjustment'::TEXT as pattern_type,
      jsonb_build_object(
        'bug_type', bug_type,
        'avg_similarity', AVG(COALESCE(similarity_score, 0)),
        'min_similarity', MIN(COALESCE(similarity_score, 0)),
        'max_similarity', MAX(COALESCE(similarity_score, 0)),
        'suggested_threshold', AVG(COALESCE(similarity_score, 0)) - 0.05
      ) as pattern_data,
      CASE 
        WHEN COUNT(*) >= 10 THEN 0.8
        WHEN COUNT(*) >= 5 THEN 0.6
        ELSE 0.4
      END as confidence,
      COUNT(*)::BIGINT as report_count
    FROM recent_reports
    WHERE similarity_score IS NOT NULL
    GROUP BY bug_type
    HAVING COUNT(*) >= min_reports
  ),
  
  -- 2. 유의어 발견: 기대한 답변과 AI 제안 답변이 다른데 유사도가 높은 경우
  synonym_patterns AS (
    SELECT 
      'synonym_discovery'::TEXT as pattern_type,
      jsonb_build_object(
        'question_token', LOWER(TRIM(SPLIT_PART(question_text, ' ', 1))),
        'expected', expected_answer,
        'ai_suggested', ai_suggested_answer,
        'context', SUBSTRING(problem_content, 1, 100)
      ) as pattern_data,
      0.5 as confidence,
      COUNT(*)::BIGINT as report_count
    FROM recent_reports
    WHERE expected_answer IS NOT NULL
      AND expected_answer != ai_suggested_answer
      AND similarity_score IS NOT NULL
      AND similarity_score > 0.4
    GROUP BY 
      LOWER(TRIM(SPLIT_PART(question_text, ' ', 1))),
      expected_answer,
      ai_suggested_answer,
      SUBSTRING(problem_content, 1, 100)
    HAVING COUNT(*) >= min_reports
  ),
  
  -- 3. 문맥 규칙: 특정 문맥에서 자주 틀리는 경우
  context_patterns AS (
    SELECT 
      'context_rule'::TEXT as pattern_type,
      jsonb_build_object(
        'bug_type', bug_type,
        'common_keywords', ARRAY_AGG(DISTINCT LOWER(TRIM(SPLIT_PART(question_text, ' ', 1)))),
        'language', language
      ) as pattern_data,
      CASE 
        WHEN COUNT(*) >= 10 THEN 0.7
        WHEN COUNT(*) >= 5 THEN 0.5
        ELSE 0.3
      END as confidence,
      COUNT(*)::BIGINT as report_count
    FROM recent_reports
    WHERE question_text IS NOT NULL
    GROUP BY bug_type, language
    HAVING COUNT(*) >= min_reports
  )
  
  SELECT * FROM threshold_patterns
  UNION ALL
  SELECT * FROM synonym_patterns
  UNION ALL
  SELECT * FROM context_patterns;
END;
$$;

-- 4. 통계 업데이트 함수도 ignore_for_learning 필터 추가
CREATE OR REPLACE FUNCTION update_ai_learning_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today_date DATE := CURRENT_DATE;
  stats_record RECORD;
BEGIN
  -- 오늘 날짜의 통계가 있는지 확인
  SELECT * INTO stats_record
  FROM ai_learning_stats
  WHERE stat_date = today_date;
  
  IF stats_record IS NULL THEN
    -- 새로 생성 (ignore_for_learning = false인 것만 카운트)
    INSERT INTO ai_learning_stats (
      stat_date,
      total_bug_reports,
      wrong_yes_no_count,
      wrong_answer_count,
      wrong_irrelevant_count,
      wrong_similarity_count,
      other_count,
      avg_confidence,
      patterns_discovered,
      patterns_applied
    )
    SELECT 
      today_date,
      COUNT(*)::INTEGER,
      COUNT(*) FILTER (WHERE bug_type = 'wrong_yes_no')::INTEGER,
      COUNT(*) FILTER (WHERE bug_type = 'wrong_answer')::INTEGER,
      COUNT(*) FILTER (WHERE bug_type = 'wrong_irrelevant')::INTEGER,
      COUNT(*) FILTER (WHERE bug_type = 'wrong_similarity')::INTEGER,
      COUNT(*) FILTER (WHERE bug_type = 'other')::INTEGER,
      AVG(COALESCE(similarity_score, 0)),
      (SELECT COUNT(*) FROM ai_learning_patterns WHERE DATE(created_at) = today_date)::INTEGER,
      (SELECT COUNT(*) FROM ai_learning_patterns WHERE DATE(applied_at) = today_date)::INTEGER
    FROM ai_bug_reports
    WHERE DATE(created_at) = today_date
      AND ignore_for_learning = false;
  ELSE
    -- 업데이트 (ignore_for_learning = false인 것만 카운트)
    UPDATE ai_learning_stats
    SET
      total_bug_reports = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND ignore_for_learning = false
      ),
      wrong_yes_no_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND bug_type = 'wrong_yes_no'
          AND ignore_for_learning = false
      ),
      wrong_answer_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND bug_type = 'wrong_answer'
          AND ignore_for_learning = false
      ),
      wrong_irrelevant_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND bug_type = 'wrong_irrelevant'
          AND ignore_for_learning = false
      ),
      wrong_similarity_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND bug_type = 'wrong_similarity'
          AND ignore_for_learning = false
      ),
      other_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date 
          AND bug_type = 'other'
          AND ignore_for_learning = false
      ),
      avg_confidence = (
        SELECT AVG(COALESCE(similarity_score, 0)) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date
          AND ignore_for_learning = false
      ),
      patterns_discovered = (
        SELECT COUNT(*) FROM ai_learning_patterns WHERE DATE(created_at) = today_date
      ),
      patterns_applied = (
        SELECT COUNT(*) FROM ai_learning_patterns WHERE DATE(applied_at) = today_date
      ),
      updated_at = NOW()
    WHERE stat_date = today_date;
  END IF;
END;
$$;

-- 5. 관리자가 버그 리포트를 업데이트할 수 있도록 RLS 정책 추가
DO $$
BEGIN
  -- 기존 정책이 있으면 삭제
  DROP POLICY IF EXISTS "Admins can update all bug reports" ON ai_bug_reports;
  DROP POLICY IF EXISTS "Admins can read all bug reports" ON ai_bug_reports;
  
  -- 새 정책 생성
  CREATE POLICY "Admins can update all bug reports" ON ai_bug_reports
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.is_admin = true
      )
    );

  CREATE POLICY "Admins can read all bug reports" ON ai_bug_reports
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.is_admin = true
      )
      OR auth.uid() = user_id
      OR user_id IS NULL
    );
END $$;

