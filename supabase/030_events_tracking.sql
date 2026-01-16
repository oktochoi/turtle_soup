-- 전환 퍼널 이벤트 DB: Vercel Analytics 대체

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  game_user_id UUID REFERENCES game_users(id) ON DELETE SET NULL,
  guest_id TEXT, -- 비로그인 사용자 식별자
  
  -- 이벤트 정보
  event_type TEXT NOT NULL, -- view_problem, click_cta_invite, create_room, join_room, submit_question, submit_guess, etc.
  event_category TEXT, -- navigation, engagement, conversion, etc.
  
  -- 메타데이터 (JSONB로 유연하게 저장)
  meta JSONB DEFAULT '{}'::JSONB,
  
  -- 컨텍스트 정보
  page_path TEXT, -- 현재 페이지 경로
  page_referrer TEXT, -- 이전 페이지
  user_agent TEXT,
  language TEXT DEFAULT 'ko',
  
  -- UTM 파라미터
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_game_user_id ON events(game_user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_event_category ON events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_guest_id ON events(guest_id);

-- JSONB 인덱스 (메타데이터 검색용)
-- GIN 인덱스는 JSONB 전체에 대해 생성하고, 특정 키는 쿼리에서 사용
CREATE INDEX IF NOT EXISTS idx_events_meta ON events USING GIN (meta);

-- 이벤트 기록 함수 (간편한 사용을 위해)
CREATE OR REPLACE FUNCTION track_event(
  p_event_type TEXT,
  p_event_category TEXT DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::JSONB,
  p_page_path TEXT DEFAULT NULL,
  p_page_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'ko',
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
  current_user_id UUID;
  current_game_user_id UUID;
  current_guest_id TEXT;
BEGIN
  -- 현재 사용자 정보 가져오기
  current_user_id := auth.uid();
  
  -- game_user_id 가져오기 (auth_user_id로)
  IF current_user_id IS NOT NULL THEN
    SELECT id INTO current_game_user_id
    FROM game_users
    WHERE auth_user_id = current_user_id
    LIMIT 1;
  END IF;
  
  -- 이벤트 기록
  INSERT INTO events (
    user_id,
    game_user_id,
    guest_id,
    event_type,
    event_category,
    meta,
    page_path,
    page_referrer,
    user_agent,
    language,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content
  )
  VALUES (
    current_user_id,
    current_game_user_id,
    current_guest_id,
    p_event_type,
    p_event_category,
    p_meta,
    p_page_path,
    p_page_referrer,
    p_user_agent,
    p_language,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_utm_term,
    p_utm_content
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- 이벤트 통계 조회 함수
CREATE OR REPLACE FUNCTION get_event_stats(
  p_event_type TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  event_type TEXT,
  event_count BIGINT,
  unique_users BIGINT,
  unique_guests BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.event_type,
    COUNT(*)::BIGINT as event_count,
    COUNT(DISTINCT e.user_id)::BIGINT as unique_users,
    COUNT(DISTINCT e.guest_id)::BIGINT as unique_guests
  FROM events e
  WHERE (p_event_type IS NULL OR e.event_type = p_event_type)
    AND (p_start_date IS NULL OR DATE(e.created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(e.created_at) <= p_end_date)
  GROUP BY e.event_type
  ORDER BY event_count DESC;
END;
$$;

-- 전환 퍼널 분석 함수
CREATE OR REPLACE FUNCTION get_conversion_funnel(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  step TEXT,
  event_type TEXT,
  count BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_views BIGINT;
BEGIN
  -- 전체 조회 수
  SELECT COUNT(*) INTO total_views
  FROM events
  WHERE event_type = 'view_problem'
    AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date);
  
  -- 각 단계별 이벤트 수 및 전환율 계산
  RETURN QUERY
  WITH step_counts AS (
    SELECT 
      CASE 
        WHEN event_type = 'view_problem' THEN 1
        WHEN event_type = 'click_cta_invite' THEN 2
        WHEN event_type = 'create_room' THEN 3
        WHEN event_type = 'join_room' THEN 4
        WHEN event_type = 'submit_question' THEN 5
        WHEN event_type = 'submit_guess' THEN 6
        ELSE 0
      END as step_order,
      CASE 
        WHEN event_type = 'view_problem' THEN '문제 조회'
        WHEN event_type = 'click_cta_invite' THEN '초대 링크 클릭'
        WHEN event_type = 'create_room' THEN '방 생성'
        WHEN event_type = 'join_room' THEN '방 참여'
        WHEN event_type = 'submit_question' THEN '질문 제출'
        WHEN event_type = 'submit_guess' THEN '정답 제출'
        ELSE event_type
      END as step_name,
      event_type,
      COUNT(*)::BIGINT as count
    FROM events
    WHERE event_type IN ('view_problem', 'click_cta_invite', 'create_room', 'join_room', 'submit_question', 'submit_guess')
      AND (p_start_date IS NULL OR DATE(created_at) >= p_start_date)
      AND (p_end_date IS NULL OR DATE(created_at) <= p_end_date)
    GROUP BY event_type
  )
  SELECT 
    sc.step_name::TEXT as step,
    sc.event_type::TEXT,
    sc.count,
    CASE 
      WHEN total_views > 0 THEN ROUND((sc.count::NUMERIC / total_views::NUMERIC) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM step_counts sc
  WHERE sc.step_order > 0
  ORDER BY sc.step_order;
END;
$$;

-- RLS 정책
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Users can read own events" ON events;
DROP POLICY IF EXISTS "Anyone can create events" ON events;
DROP POLICY IF EXISTS "Admins can read all events" ON events;

-- 모든 사용자가 자신의 이벤트를 읽을 수 있도록 설정
CREATE POLICY "Users can read own events" ON events
  FOR SELECT USING (
    user_id = auth.uid() OR 
    game_user_id IN (SELECT id FROM game_users WHERE auth_user_id = auth.uid())
  );

-- 모든 사용자가 이벤트를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create events" ON events
  FOR INSERT WITH CHECK (true);

-- 관리자는 모든 이벤트를 읽을 수 있도록 설정
CREATE POLICY "Admins can read all events" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 권한 부여
GRANT SELECT, INSERT ON events TO authenticated;
GRANT SELECT, INSERT ON events TO anon;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION track_event(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION track_event(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_event_stats(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversion_funnel(DATE, DATE) TO authenticated;

