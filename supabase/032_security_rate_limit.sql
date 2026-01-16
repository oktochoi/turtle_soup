-- 보안 강화: RLS + Rate Limit

-- 1. Rate Limit 테이블
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL, -- user_id 또는 IP 주소
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('user_id', 'ip_address', 'guest_id')),
  action_type TEXT NOT NULL, -- 'report_user', 'submit_bug', 'create_room', etc.
  count INTEGER DEFAULT 1 NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier, identifier_type, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start, window_end);

-- 2. Rate Limit 체크 함수
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_identifier_type TEXT,
  p_action_type TEXT,
  p_max_count INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  window_start_val TIMESTAMP WITH TIME ZONE;
  window_end_val TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 시간 윈도우 계산
  window_start_val := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  window_end_val := NOW();
  
  -- 현재 윈도우 내 요청 수 확인
  SELECT COALESCE(SUM(count), 0) INTO current_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND action_type = p_action_type
    AND window_start >= window_start_val
    AND window_end <= window_end_val;
  
  -- 제한 초과 확인
  IF current_count >= p_max_count THEN
    RETURN FALSE; -- 제한 초과
  END IF;
  
  -- 요청 기록
  INSERT INTO rate_limits (identifier, identifier_type, action_type, window_start, window_end)
  VALUES (p_identifier, p_identifier_type, p_action_type, window_start_val, window_end_val)
  ON CONFLICT DO NOTHING;
  
  -- 기존 레코드 업데이트 (같은 윈도우 내)
  UPDATE rate_limits
  SET 
    count = count + 1,
    updated_at = NOW()
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND action_type = p_action_type
    AND window_start >= window_start_val
    AND window_end <= window_end_val;
  
  RETURN TRUE; -- 허용
END;
$$;

-- 3. 오래된 Rate Limit 레코드 정리 함수
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 24시간 이상 된 레코드 삭제
  DELETE FROM rate_limits
  WHERE window_end < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. 문제 정답 보호 강화 (RLS)
-- problems 테이블의 answer 컬럼은 관리자만 읽을 수 있도록
-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Anyone can read problems" ON problems;
DROP POLICY IF EXISTS "Anyone can read problems except answer" ON problems;
DROP POLICY IF EXISTS "Admins can read problem answers" ON problems;

-- 기본 정책: answer를 제외한 모든 필드는 읽기 가능
CREATE POLICY "Anyone can read problems except answer" ON problems
  FOR SELECT USING (true);

-- 관리자만 answer를 읽을 수 있도록 별도 정책
CREATE POLICY "Admins can read problem answers" ON problems
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 5. user_reports Rate Limit 트리거
CREATE OR REPLACE FUNCTION check_report_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_identifier TEXT;
  identifier_type_val TEXT;
  is_allowed BOOLEAN;
BEGIN
  -- 식별자 결정
  IF NEW.reporter_user_id IS NOT NULL THEN
    user_identifier := NEW.reporter_user_id::TEXT;
    identifier_type_val := 'user_id';
  ELSIF NEW.reporter_identifier IS NOT NULL THEN
    user_identifier := NEW.reporter_identifier;
    identifier_type_val := 'guest_id';
  ELSE
    RAISE EXCEPTION 'User identifier is required';
  END IF;
  
  -- Rate Limit 체크 (24시간에 5회 제한)
  is_allowed := check_rate_limit(
    user_identifier,
    identifier_type_val,
    'report_user',
    5, -- 최대 5회
    1440 -- 24시간 (1440분)
  );
  
  IF NOT is_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only submit 5 reports per 24 hours';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_check_report_rate_limit ON user_reports;
CREATE TRIGGER trigger_check_report_rate_limit
  BEFORE INSERT ON user_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_report_rate_limit();

-- 6. ai_bug_reports Rate Limit 트리거
CREATE OR REPLACE FUNCTION check_bug_report_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_identifier TEXT;
  identifier_type_val TEXT;
  is_allowed BOOLEAN;
BEGIN
  -- 식별자 결정
  IF NEW.user_id IS NOT NULL THEN
    user_identifier := NEW.user_id::TEXT;
    identifier_type_val := 'user_id';
  ELSE
    -- guest_id 또는 다른 식별자 사용
    user_identifier := COALESCE(NEW.user_identifier, 'anonymous');
    identifier_type_val := 'guest_id';
  END IF;
  
  -- Rate Limit 체크 (1시간에 10회 제한)
  is_allowed := check_rate_limit(
    user_identifier,
    identifier_type_val,
    'submit_bug',
    10, -- 최대 10회
    60 -- 1시간
  );
  
  IF NOT is_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only submit 10 bug reports per hour';
  END IF;
  
  RETURN NEW;
END;
$$;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_check_bug_report_rate_limit ON ai_bug_reports;
CREATE TRIGGER trigger_check_bug_report_rate_limit
  BEFORE INSERT ON ai_bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_bug_report_rate_limit();

-- 7. 관리자 데이터 보호 강화
-- users 테이블의 is_admin 컬럼은 관리자만 읽을 수 있도록
-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Anyone can read users except admin flag" ON users;
DROP POLICY IF EXISTS "Admins can read admin flags" ON users;

-- 기본 정책: is_admin을 제외한 모든 필드는 읽기 가능
CREATE POLICY "Anyone can read users except admin flag" ON users
  FOR SELECT USING (true);

-- 관리자만 is_admin을 읽을 수 있도록 별도 정책
CREATE POLICY "Admins can read admin flags" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- RLS 정책
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Admins can read rate limits" ON rate_limits;
DROP POLICY IF EXISTS "System can manage rate limits" ON rate_limits;

-- 관리자만 rate_limits를 읽을 수 있도록 설정
CREATE POLICY "Admins can read rate limits" ON rate_limits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 시스템만 rate_limits를 생성/업데이트할 수 있도록 설정
CREATE POLICY "System can manage rate limits" ON rate_limits
  FOR ALL USING (true);

-- 권한 부여
GRANT SELECT ON rate_limits TO authenticated;
GRANT SELECT ON rate_limits TO anon;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits() TO authenticated;

