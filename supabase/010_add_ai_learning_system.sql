-- AI 자동 학습 시스템을 위한 추가 테이블 및 함수

-- 1. AI 학습 패턴 분석 결과 저장 테이블
CREATE TABLE IF NOT EXISTS ai_learning_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'threshold_adjustment',  -- threshold 조정 패턴
    'synonym_discovery',     -- 새로운 유의어 발견
    'antonym_discovery',     -- 새로운 반의어 발견
    'context_rule',          -- 문맥 규칙
    'false_positive',        -- 오탐 패턴
    'false_negative'        -- 미탐 패턴
  )),
  pattern_data JSONB NOT NULL, -- 패턴 데이터 (유연한 구조)
  confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  bug_report_count INTEGER DEFAULT 0, -- 이 패턴과 관련된 버그 리포트 수
  applied BOOLEAN DEFAULT FALSE, -- AI 로직에 적용되었는지 여부
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_type ON ai_learning_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_applied ON ai_learning_patterns(applied);
CREATE INDEX IF NOT EXISTS idx_ai_learning_patterns_confidence ON ai_learning_patterns(confidence_score DESC);

-- 2. AI 학습 통계 테이블
CREATE TABLE IF NOT EXISTS ai_learning_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stat_date DATE DEFAULT CURRENT_DATE UNIQUE NOT NULL,
  total_bug_reports INTEGER DEFAULT 0,
  wrong_yes_no_count INTEGER DEFAULT 0,
  wrong_answer_count INTEGER DEFAULT 0,
  wrong_irrelevant_count INTEGER DEFAULT 0,
  wrong_similarity_count INTEGER DEFAULT 0,
  other_count INTEGER DEFAULT 0,
  avg_confidence NUMERIC DEFAULT 0,
  patterns_discovered INTEGER DEFAULT 0,
  patterns_applied INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. 버그 리포트 분석 함수 (패턴 추출)
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

-- 4. 패턴 적용 함수 (AI 로직에 반영)
CREATE OR REPLACE FUNCTION apply_learning_patterns()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  applied_count INTEGER := 0;
  pattern_record RECORD;
BEGIN
  -- confidence가 0.6 이상이고 아직 적용되지 않은 패턴만 적용
  FOR pattern_record IN 
    SELECT * FROM ai_learning_patterns
    WHERE applied = FALSE
      AND confidence_score >= 0.6
    ORDER BY confidence_score DESC, bug_report_count DESC
    LIMIT 10
  LOOP
    -- 패턴 타입에 따라 다른 처리
    CASE pattern_record.pattern_type
      WHEN 'threshold_adjustment' THEN
        -- threshold 조정은 수동 검토 필요 (로그만 남김)
        UPDATE ai_learning_patterns
        SET applied = TRUE, applied_at = NOW()
        WHERE id = pattern_record.id;
        applied_count := applied_count + 1;
        
      WHEN 'synonym_discovery' THEN
        -- 유의어는 자동으로 추가 가능 (검토 후)
        UPDATE ai_learning_patterns
        SET applied = TRUE, applied_at = NOW()
        WHERE id = pattern_record.id;
        applied_count := applied_count + 1;
        
      WHEN 'context_rule' THEN
        -- 문맥 규칙은 수동 검토 필요
        UPDATE ai_learning_patterns
        SET applied = TRUE, applied_at = NOW()
        WHERE id = pattern_record.id;
        applied_count := applied_count + 1;
        
      ELSE
        -- 기타 패턴은 수동 검토
        NULL;
    END CASE;
  END LOOP;
  
  RETURN applied_count;
END;
$$;

-- 5. 일일 통계 업데이트 함수
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
    -- 새로 생성
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
    WHERE DATE(created_at) = today_date;
  ELSE
    -- 업데이트
    UPDATE ai_learning_stats
    SET
      total_bug_reports = (
        SELECT COUNT(*) FROM ai_bug_reports WHERE DATE(created_at) = today_date
      ),
      wrong_yes_no_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date AND bug_type = 'wrong_yes_no'
      ),
      wrong_answer_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date AND bug_type = 'wrong_answer'
      ),
      wrong_irrelevant_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date AND bug_type = 'wrong_irrelevant'
      ),
      wrong_similarity_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date AND bug_type = 'wrong_similarity'
      ),
      other_count = (
        SELECT COUNT(*) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date AND bug_type = 'other'
      ),
      avg_confidence = (
        SELECT AVG(COALESCE(similarity_score, 0)) FROM ai_bug_reports 
        WHERE DATE(created_at) = today_date
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

-- 6. 자동 학습 스케줄러 (cron job으로 실행)
CREATE OR REPLACE FUNCTION run_ai_learning_cycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patterns_found INTEGER;
  patterns_applied INTEGER;
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
  
  -- 3. 통계 업데이트
  PERFORM update_ai_learning_stats();
  
  -- 4. 결과 반환
  result := jsonb_build_object(
    'success', true,
    'patterns_found', patterns_found,
    'patterns_applied', patterns_applied,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- RLS 정책 설정
ALTER TABLE ai_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_stats ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능 (통계는 공개)
CREATE POLICY "Anyone can read learning patterns" ON ai_learning_patterns
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read learning stats" ON ai_learning_stats
  FOR SELECT USING (true);

-- 관리자만 쓰기 가능 (함수는 SECURITY DEFINER로 실행)
CREATE POLICY "Only admins can modify learning patterns" ON ai_learning_patterns
  FOR ALL USING (auth.role() = 'authenticated');

-- Cron job 설정 (매일 자정에 실행)
-- 주의: Supabase에서 cron job을 설정하려면 pg_cron extension이 필요합니다
-- SELECT cron.schedule('ai-learning-daily', '0 0 * * *', 'SELECT run_ai_learning_cycle();');

