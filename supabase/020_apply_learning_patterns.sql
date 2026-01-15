-- 학습 패턴 적용 및 학습된 오류 추적 시스템

-- 1. 학습된 오류 패턴 추적 테이블
CREATE TABLE IF NOT EXISTS ai_learned_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_hash TEXT UNIQUE NOT NULL, -- 오류 패턴의 해시값 (중복 방지)
  bug_type TEXT NOT NULL,
  question_pattern TEXT NOT NULL, -- 질문 패턴 (정규화된 형태)
  expected_answer TEXT NOT NULL,
  ai_suggested_answer TEXT NOT NULL,
  problem_content_hash TEXT, -- 문제 내용 해시 (선택사항)
  similarity_score_range NUMERIC[], -- 유사도 점수 범위 [min, max]
  learning_pattern_id UUID REFERENCES ai_learning_patterns(id) ON DELETE SET NULL,
  bug_report_id UUID REFERENCES ai_bug_reports(id) ON DELETE SET NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  check_count INTEGER DEFAULT 0, -- 이 패턴이 체크된 횟수
  prevented_count INTEGER DEFAULT 0, -- 이 패턴으로 인해 오류가 방지된 횟수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_learned_errors_pattern_hash ON ai_learned_errors(pattern_hash);
CREATE INDEX IF NOT EXISTS idx_ai_learned_errors_question_pattern ON ai_learned_errors(question_pattern);
CREATE INDEX IF NOT EXISTS idx_ai_learned_errors_bug_type ON ai_learned_errors(bug_type);

-- 2. 학습 패턴을 learned_errors에 자동으로 추가하는 함수
CREATE OR REPLACE FUNCTION sync_learning_patterns_to_errors()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  synced_count INTEGER := 0;
  pattern_record RECORD;
  v_pattern_hash TEXT;  -- 변수 이름 변경하여 컬럼과 구분
BEGIN
  -- applied = true인 패턴들을 learned_errors에 동기화
  FOR pattern_record IN
    SELECT 
      lp.*,
      br.question_text,
      br.expected_answer,
      br.ai_suggested_answer,
      br.bug_type,
      br.similarity_score,
      br.problem_content
    FROM ai_learning_patterns lp
    LEFT JOIN ai_bug_reports br ON br.id = (
      SELECT id FROM ai_bug_reports 
      WHERE ignore_for_learning = false 
        AND status = 'pending'
      ORDER BY created_at DESC 
      LIMIT 1
    )
    WHERE lp.applied = true
      AND lp.applied_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ai_learned_errors 
        WHERE learning_pattern_id = lp.id
      )
  LOOP
    -- 패턴 해시 생성 (질문 패턴 + 기대 답변 + AI 제안 답변)
    v_pattern_hash := MD5(
      COALESCE(pattern_record.pattern_data->>'question_token', '') || '|' ||
      COALESCE(pattern_record.pattern_data->>'expected', '') || '|' ||
      COALESCE(pattern_record.pattern_data->>'ai_suggested', '') || '|' ||
      pattern_record.pattern_type
    );

    INSERT INTO ai_learned_errors (
      pattern_hash,
      bug_type,
      question_pattern,
      expected_answer,
      ai_suggested_answer,
      similarity_score_range,
      learning_pattern_id
    )
    VALUES (
      v_pattern_hash,  -- 변수 사용
      COALESCE(
        (pattern_record.pattern_data->>'bug_type')::TEXT,
        'other'
      ),
      COALESCE(
        pattern_record.pattern_data->>'question_token',
        LOWER(TRIM(SPLIT_PART(COALESCE(pattern_record.question_text, ''), ' ', 1)))
      ),
      COALESCE(
        pattern_record.pattern_data->>'expected',
        pattern_record.expected_answer,
        'unknown'
      ),
      COALESCE(
        pattern_record.pattern_data->>'ai_suggested',
        pattern_record.ai_suggested_answer,
        'unknown'
      ),
      CASE 
        WHEN pattern_record.pattern_data->>'avg_similarity' IS NOT NULL THEN
          ARRAY[
            (pattern_record.pattern_data->>'min_similarity')::NUMERIC,
            (pattern_record.pattern_data->>'max_similarity')::NUMERIC
          ]
        ELSE NULL
      END,
      pattern_record.id
    )
    ON CONFLICT (pattern_hash) DO UPDATE
    SET 
      last_checked_at = NOW(),
      check_count = ai_learned_errors.check_count + 1;

    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

-- 3. 버그 리포트를 체크하여 학습된 오류인지 확인하는 함수
CREATE OR REPLACE FUNCTION check_if_learned_error(
  p_question_text TEXT,
  p_ai_suggested_answer TEXT,
  p_expected_answer TEXT,
  p_bug_type TEXT,
  p_similarity_score NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  is_learned_error BOOLEAN,
  matched_pattern_id UUID,
  matched_pattern_hash TEXT,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  question_token TEXT;
  match_record RECORD;
BEGIN
  -- 질문에서 첫 번째 토큰 추출 (정규화)
  question_token := LOWER(TRIM(SPLIT_PART(p_question_text, ' ', 1)));

  -- 학습된 오류 패턴과 매칭
  FOR match_record IN
    SELECT *
    FROM ai_learned_errors
    WHERE bug_type = p_bug_type
      AND (
        question_pattern = question_token
        OR question_pattern = LOWER(TRIM(p_question_text))
      )
      AND expected_answer = p_expected_answer
      AND ai_suggested_answer = p_ai_suggested_answer
      AND (
        p_similarity_score IS NULL
        OR similarity_score_range IS NULL
        OR (
          p_similarity_score >= similarity_score_range[1]
          AND p_similarity_score <= similarity_score_range[2]
        )
      )
    ORDER BY applied_at DESC
    LIMIT 1
  LOOP
    -- 매칭된 패턴 발견
    UPDATE ai_learned_errors
    SET 
      last_checked_at = NOW(),
      check_count = check_count + 1,
      prevented_count = prevented_count + 1
    WHERE id = match_record.id;

    RETURN QUERY SELECT 
      true,
      match_record.id,
      match_record.pattern_hash,
      0.8::NUMERIC; -- 기본 신뢰도
  END LOOP;

  -- 매칭되지 않음
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, 0.0::NUMERIC;
  END IF;
END;
$$;

-- 4. 학습 실행 시 자동으로 learned_errors에 동기화 (기존 함수 업데이트)
-- 기존 run_ai_learning_cycle 함수를 확장하여 learned_errors 동기화 추가
CREATE OR REPLACE FUNCTION run_ai_learning_cycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patterns_found INTEGER;
  patterns_applied INTEGER;
  errors_synced INTEGER;
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
  
  -- 4. 통계 업데이트
  PERFORM update_ai_learning_stats();
  
  -- 5. 결과 반환
  result := jsonb_build_object(
    'success', true,
    'patterns_found', patterns_found,
    'patterns_applied', patterns_applied,
    'errors_synced', COALESCE(errors_synced, 0),
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- 5. RLS 정책 설정
ALTER TABLE ai_learned_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read learned errors" ON ai_learned_errors
  FOR SELECT USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Only admins can modify learned errors" ON ai_learned_errors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
  );

-- 6. 주석 추가
COMMENT ON TABLE ai_learned_errors IS 
'학습된 오류 패턴을 추적하여 같은 오류가 다시 발생하지 않도록 방지합니다.';

COMMENT ON FUNCTION check_if_learned_error IS 
'버그 리포트가 학습된 오류 패턴과 일치하는지 확인합니다. 
일치하면 true를 반환하고, 해당 패턴의 정보를 반환합니다.';

COMMENT ON FUNCTION sync_learning_patterns_to_errors IS 
'적용된 학습 패턴을 learned_errors 테이블에 동기화합니다.';

