-- AI 학습 시스템 안전장치 추가
-- context_rule 불용어 필터, synonym_discovery blacklist, 패턴 롤백 기능

-- 1. 불용어 필터 함수 (context_rule용)
CREATE OR REPLACE FUNCTION filter_stopwords(keywords TEXT[])
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  filtered_keywords TEXT[];
  keyword TEXT;
  stopwords TEXT[] := ARRAY[
    -- 조사/대명사
    '그', '이', '저', '는', '가', '을', '를', '의', '에', '에서', '로',
    -- 역할 단어
    '주인공', '남자', '여자', '아이', '엄마', '아빠', '부모', '아들',
    -- A/B 토큰
    'a는', 'b는', 'x는', 'a', 'b', 'x'
  ];
BEGIN
  filtered_keywords := ARRAY[]::TEXT[];
  
  FOREACH keyword IN ARRAY keywords
  LOOP
    -- 불용어가 아니고, 최소 2글자 이상인 키워드만 포함
    IF NOT (keyword = ANY(stopwords)) 
       AND LENGTH(keyword) >= 2 
       AND keyword NOT LIKE '%는' 
       AND keyword NOT LIKE '%가' 
       AND keyword NOT LIKE '%을' 
       AND keyword NOT LIKE '%를'
       AND keyword NOT LIKE '%의'
       AND keyword NOT LIKE '%에'
       AND keyword NOT LIKE '%에서'
       AND keyword NOT LIKE '%로'
    THEN
      filtered_keywords := array_append(filtered_keywords, keyword);
    END IF;
  END LOOP;
  
  RETURN filtered_keywords;
END;
$$;

-- 2. synonym_discovery blacklist 체크 함수
CREATE OR REPLACE FUNCTION is_valid_synonym_token(token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  blacklist TEXT[] := ARRAY[
    -- 한 글자 조사
    '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '와', '과',
    -- 두 글자 조사 (은/는/이/가로 끝나는 모든 토큰)
    -- A/B 토큰
    'a는', 'b는', 'x는', 'a', 'b', 'x',
    -- 인물 역할
    '주인공', '남자', '여자', '아이', '엄마', '아빠', '부모', '아들', '딸', '할머니', '할아버지'
  ];
BEGIN
  -- blacklist에 있으면 false
  IF token = ANY(blacklist) THEN
    RETURN false;
  END IF;
  
  -- 한 글자면 false
  IF LENGTH(token) < 2 THEN
    RETURN false;
  END IF;
  
  -- 조사로 끝나면 false
  IF token LIKE '%는' OR token LIKE '%가' OR token LIKE '%을' 
     OR token LIKE '%를' OR token LIKE '%의' OR token LIKE '%에'
     OR token LIKE '%에서' OR token LIKE '%로' OR token LIKE '%와' 
     OR token LIKE '%과' THEN
    RETURN false;
  END IF;
  
  -- 최소 2-3단어짜리 의미 단위만 허용 (공백 포함 체크)
  -- 단일 토큰이지만 의미 있는 단어인 경우 허용 (예: "시간정지", "수조속")
  IF LENGTH(token) >= 3 THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- 3. analyze_bug_reports_for_learning 함수 업데이트 (불용어 필터 적용)
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
      AND ignore_for_learning = false
      AND studied = false
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
  -- blacklist 필터 적용
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
      -- blacklist 필터: 유효한 토큰만 허용
      AND is_valid_synonym_token(LOWER(TRIM(SPLIT_PART(question_text, ' ', 1))))
    GROUP BY 
      LOWER(TRIM(SPLIT_PART(question_text, ' ', 1))),
      expected_answer,
      ai_suggested_answer,
      SUBSTRING(problem_content, 1, 100)
    HAVING COUNT(*) >= min_reports
  ),
  
  -- 3. 문맥 규칙: 특정 문맥에서 자주 틀리는 경우
  -- 불용어 필터 적용하여 common_keywords 정제
  context_patterns_raw AS (
    SELECT 
      bug_type,
      language,
      ARRAY_AGG(DISTINCT LOWER(TRIM(SPLIT_PART(question_text, ' ', 1)))) as raw_keywords,
      COUNT(*)::BIGINT as report_count
    FROM recent_reports
    WHERE question_text IS NOT NULL
    GROUP BY bug_type, language
    HAVING COUNT(*) >= min_reports
  ),
  context_patterns AS (
    SELECT 
      'context_rule'::TEXT as pattern_type,
      jsonb_build_object(
        'bug_type', bug_type,
        'common_keywords', filter_stopwords(raw_keywords), -- 불용어 필터 적용
        'language', language
      ) as pattern_data,
      CASE 
        WHEN report_count >= 10 THEN 0.7
        WHEN report_count >= 5 THEN 0.5
        ELSE 0.3
      END as confidence,
      report_count
    FROM context_patterns_raw
    -- 필터링 후 키워드가 남아있는 경우만 포함
    WHERE array_length(filter_stopwords(raw_keywords), 1) > 0
  )
  
  SELECT * FROM threshold_patterns
  UNION ALL
  SELECT * FROM synonym_patterns
  UNION ALL
  SELECT * FROM context_patterns;
END;
$$;

-- 4. 패턴 롤백 함수 (applied=true를 false로 되돌림)
CREATE OR REPLACE FUNCTION rollback_applied_patterns(
  pattern_type_filter TEXT DEFAULT NULL,
  min_bug_report_count INTEGER DEFAULT 400
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rollback_count INTEGER;
  result JSONB;
BEGIN
  -- applied=true인 패턴들을 롤백
  UPDATE ai_learning_patterns
  SET 
    applied = false,
    applied_at = NULL
  WHERE applied = true
    AND (
      pattern_type_filter IS NULL 
      OR pattern_type = pattern_type_filter
    )
    AND (
      -- context_rule이고 bug_report_count가 큰 경우
      (pattern_type = 'context_rule' AND bug_report_count >= min_bug_report_count)
      -- synonym_discovery이고 주어 토큰 기반인 경우
      OR (pattern_type = 'synonym_discovery' 
          AND pattern_data->>'question_token' IS NOT NULL
          AND NOT is_valid_synonym_token(pattern_data->>'question_token'))
      -- 또는 모든 applied 패턴 롤백 (pattern_type_filter가 NULL인 경우)
      OR (pattern_type_filter IS NULL)
    );
  
  GET DIAGNOSTICS rollback_count = ROW_COUNT;
  
  -- learned_errors에서도 해당 패턴 제거
  DELETE FROM ai_learned_errors
  WHERE learning_pattern_id IN (
    SELECT id FROM ai_learning_patterns
    WHERE applied = false
      AND applied_at IS NULL
  );
  
  result := jsonb_build_object(
    'success', true,
    'patterns_rolled_back', rollback_count,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$;

-- 5. 기존 applied=true 패턴 롤백 실행 (응급처방)
-- context_rule과 synonym_discovery 중 문제가 될 수 있는 패턴 롤백
DO $$
DECLARE
  rollback_result JSONB;
BEGIN
  -- context_rule 롤백 (bug_report_count 400 이상)
  SELECT rollback_applied_patterns('context_rule', 400) INTO rollback_result;
  RAISE NOTICE 'Context rule rollback: %', rollback_result;
  
  -- synonym_discovery 롤백 (주어 토큰 기반)
  SELECT rollback_applied_patterns('synonym_discovery', 0) INTO rollback_result;
  RAISE NOTICE 'Synonym discovery rollback: %', rollback_result;
END;
$$;

-- 6. 주석 추가
COMMENT ON FUNCTION filter_stopwords IS 
'context_rule의 common_keywords에서 불용어(조사, 역할 단어, A/B 토큰)를 제거합니다.';

COMMENT ON FUNCTION is_valid_synonym_token IS 
'synonym_discovery의 토큰이 blacklist에 없고 최소 2-3글자 이상의 의미 있는 단어인지 확인합니다.';

COMMENT ON FUNCTION rollback_applied_patterns IS 
'적용된 패턴을 롤백합니다. context_rule과 synonym_discovery 중 문제가 될 수 있는 패턴을 되돌립니다.';

