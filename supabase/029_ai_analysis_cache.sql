-- AI 비용 절감 캐시 테이블

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE, -- (problem_id, normalized_question, language)의 해시
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  normalized_question TEXT NOT NULL, -- 정규화된 질문 (소문자, 공백 정리 등)
  language TEXT NOT NULL CHECK (language IN ('ko', 'en')),
  
  -- 캐시된 결과
  label TEXT NOT NULL CHECK (label IN ('yes', 'no', 'irrelevant', 'decisive')),
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  similarity_score NUMERIC,
  debug_info JSONB, -- 디버깅 정보 (선택사항)
  
  -- 메타데이터
  hit_count INTEGER DEFAULT 0 NOT NULL, -- 캐시 히트 횟수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE -- 캐시 만료 시간 (선택사항)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_key ON ai_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_problem_id ON ai_analysis_cache(problem_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_language ON ai_analysis_cache(language);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_cache_expires_at ON ai_analysis_cache(expires_at) WHERE expires_at IS NOT NULL;

-- 캐시 키 생성 함수
CREATE OR REPLACE FUNCTION generate_analysis_cache_key(
  p_problem_id UUID,
  p_question TEXT,
  p_language TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- 질문 정규화: 소문자, 공백 정리, 특수문자 제거
  normalized := LOWER(TRIM(REGEXP_REPLACE(p_question, '\s+', ' ', 'g')));
  
  -- 캐시 키 생성: problem_id + normalized_question + language의 해시
  RETURN MD5(p_problem_id::TEXT || '|' || normalized || '|' || p_language);
END;
$$;

-- 캐시 조회 함수
CREATE OR REPLACE FUNCTION get_analysis_cache(
  p_problem_id UUID,
  p_question TEXT,
  p_language TEXT
)
RETURNS TABLE (
  id UUID,
  label TEXT,
  confidence NUMERIC,
  similarity_score NUMERIC,
  debug_info JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cache_key_val TEXT;
BEGIN
  -- 캐시 키 생성
  cache_key_val := generate_analysis_cache_key(p_problem_id, p_question, p_language);
  
  -- 캐시 조회 (만료되지 않은 것만)
  RETURN QUERY
  SELECT 
    c.id,
    c.label,
    c.confidence,
    c.similarity_score,
    c.debug_info
  FROM ai_analysis_cache c
  WHERE c.cache_key = cache_key_val
    AND (c.expires_at IS NULL OR c.expires_at > NOW())
  LIMIT 1;
  
  -- 히트 카운트 증가 및 last_used_at 업데이트
  IF FOUND THEN
    UPDATE ai_analysis_cache
    SET 
      hit_count = hit_count + 1,
      last_used_at = NOW()
    WHERE cache_key = cache_key_val;
  END IF;
END;
$$;

-- 캐시 저장 함수
CREATE OR REPLACE FUNCTION set_analysis_cache(
  p_problem_id UUID,
  p_question TEXT,
  p_language TEXT,
  p_label TEXT,
  p_confidence NUMERIC,
  p_similarity_score NUMERIC DEFAULT NULL,
  p_debug_info JSONB DEFAULT NULL,
  p_ttl_hours INTEGER DEFAULT NULL -- TTL (Time To Live) 시간
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cache_key_val TEXT;
  cache_id UUID;
  expires_at_val TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 캐시 키 생성
  cache_key_val := generate_analysis_cache_key(p_problem_id, p_question, p_language);
  
  -- 만료 시간 계산
  IF p_ttl_hours IS NOT NULL THEN
    expires_at_val := NOW() + (p_ttl_hours || ' hours')::INTERVAL;
  ELSE
    expires_at_val := NULL;
  END IF;
  
  -- 캐시 저장 또는 업데이트
  INSERT INTO ai_analysis_cache (
    cache_key,
    problem_id,
    normalized_question,
    language,
    label,
    confidence,
    similarity_score,
    debug_info,
    expires_at
  )
  VALUES (
    cache_key_val,
    p_problem_id,
    LOWER(TRIM(REGEXP_REPLACE(p_question, '\s+', ' ', 'g'))),
    p_language,
    p_label,
    p_confidence,
    p_similarity_score,
    p_debug_info,
    expires_at_val
  )
  ON CONFLICT (cache_key) DO UPDATE
  SET 
    label = EXCLUDED.label,
    confidence = EXCLUDED.confidence,
    similarity_score = EXCLUDED.similarity_score,
    debug_info = EXCLUDED.debug_info,
    expires_at = EXCLUDED.expires_at,
    last_used_at = NOW()
  RETURNING id INTO cache_id;
  
  RETURN cache_id;
END;
$$;

-- 만료된 캐시 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_analysis_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  temp_count INTEGER;
BEGIN
  -- 만료된 캐시 삭제
  DELETE FROM ai_analysis_cache
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  -- 30일 이상 사용되지 않은 캐시도 삭제 (선택사항)
  DELETE FROM ai_analysis_cache
  WHERE last_used_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  deleted_count := deleted_count + temp_count;
  
  RETURN deleted_count;
END;
$$;

-- RLS 정책
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Anyone can read analysis cache" ON ai_analysis_cache;
DROP POLICY IF EXISTS "Authenticated can manage analysis cache" ON ai_analysis_cache;

-- 모든 사용자가 읽을 수 있도록 설정
CREATE POLICY "Anyone can read analysis cache" ON ai_analysis_cache
  FOR SELECT USING (true);

-- 인증된 사용자만 캐시를 생성/업데이트할 수 있도록 설정
CREATE POLICY "Authenticated can manage analysis cache" ON ai_analysis_cache
  FOR ALL USING (true);

-- 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_analysis_cache TO authenticated;
GRANT SELECT ON ai_analysis_cache TO anon;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION generate_analysis_cache_key(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_analysis_cache(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_analysis_cache(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_analysis_cache() TO authenticated;

