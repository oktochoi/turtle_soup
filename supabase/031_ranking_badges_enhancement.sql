-- 랭킹/스트릭/배지 시스템 강화

-- 1. 시즌 랭킹 테이블
CREATE TABLE IF NOT EXISTS season_rankings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id TEXT NOT NULL, -- 예: '2024-01', '2024-02'
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE NOT NULL,
  
  -- 랭킹 점수
  total_points INTEGER DEFAULT 0 NOT NULL,
  total_xp INTEGER DEFAULT 0 NOT NULL,
  solve_count INTEGER DEFAULT 0 NOT NULL,
  streak_days INTEGER DEFAULT 0 NOT NULL,
  
  -- 랭킹
  rank INTEGER, -- 시즌 종료 시 계산
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_rankings_season_id ON season_rankings(season_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_season_rankings_user_id ON season_rankings(user_id);

-- 2. 배지 테이블 (기존 achievements와 별도로 게임 특화 배지)
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  category TEXT NOT NULL CHECK (category IN ('room', 'solve', 'streak', 'social', 'special')),
  condition_type TEXT NOT NULL, -- 'first_room', 'first_solve', 'streak_7', 'solve_10', etc.
  condition_value INTEGER,
  reward_xp INTEGER DEFAULT 0 NOT NULL,
  reward_points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. 사용자 배지 테이블
CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE,
  badge_id INTEGER REFERENCES badges(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);

-- 4. 기본 배지 데이터 삽입
INSERT INTO badges (name, name_en, description, description_en, icon, rarity, category, condition_type, condition_value, reward_xp, reward_points) VALUES
  -- 방 관련 배지
  ('첫 방 생성', 'First Room', '첫 번째 방을 생성했습니다', 'Created your first room', '🏠', 'common', 'room', 'first_room', 1, 50, 20),
  ('방장 마스터', 'Room Master', '10개의 방을 생성했습니다', 'Created 10 rooms', '👑', 'rare', 'room', 'create_room', 10, 200, 100),
  
  -- 해결 관련 배지
  ('첫 정답', 'First Solve', '첫 번째 문제를 해결했습니다', 'Solved your first problem', '🎯', 'common', 'solve', 'first_solve', 1, 50, 20),
  ('10문제 해결', 'Problem Solver', '10개의 문제를 해결했습니다', 'Solved 10 problems', '🏆', 'rare', 'solve', 'solve_count', 10, 300, 150),
  ('100문제 해결', 'Centurion', '100개의 문제를 해결했습니다', 'Solved 100 problems', '💯', 'epic', 'solve', 'solve_count', 100, 1000, 500),
  
  -- 스트릭 관련 배지
  ('일주일 연속', 'Week Warrior', '7일 연속 참여했습니다', '7 days streak', '🔥', 'rare', 'streak', 'streak_days', 7, 200, 100),
  ('한 달 연속', 'Month Master', '30일 연속 참여했습니다', '30 days streak', '⭐', 'epic', 'streak', 'streak_days', 30, 500, 250),
  
  -- 소셜 관련 배지
  ('커뮤니티 스타', 'Community Star', '댓글을 50개 작성했습니다', 'Wrote 50 comments', '💬', 'rare', 'social', 'comment_count', 50, 200, 100),
  ('인기 작가', 'Popular Writer', '받은 좋아요 100개', 'Received 100 likes', '❤️', 'epic', 'social', 'like_count', 100, 400, 200)
ON CONFLICT (name) DO NOTHING;

-- 5. 스트릭 자동 업데이트 함수 (기존 user_progress의 current_streak과 연동)
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
  last_participation DATE;
  current_date_val DATE := CURRENT_DATE;
BEGIN
  -- user_progress의 last_participation_date 확인
  SELECT last_participation_date INTO last_participation
  FROM user_progress
  WHERE user_id = NEW.user_id;
  
  -- 오늘 첫 참여인 경우
  IF last_participation IS NULL OR last_participation < current_date_val THEN
    -- 어제 참여했으면 스트릭 연속, 아니면 1로 리셋
    IF last_participation = current_date_val - INTERVAL '1 day' THEN
      -- 스트릭 연속
      UPDATE user_progress
      SET 
        current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        last_participation_date = current_date_val
      WHERE user_id = NEW.user_id;
    ELSE
      -- 스트릭 리셋
      UPDATE user_progress
      SET 
        current_streak = 1,
        last_participation_date = current_date_val
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 배지 자동 부여 함수
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  awarded_count INTEGER := 0;
  badge_record RECORD;
  user_stats RECORD;
BEGIN
  -- 사용자 통계 가져오기
  SELECT 
    up.total_solves,
    up.current_streak,
    up.total_comments,
    COUNT(DISTINCT r.id) as room_count,
    COALESCE(SUM(p.like_count), 0) as total_likes
  INTO user_stats
  FROM user_progress up
  LEFT JOIN rooms r ON r.host_nickname IN (
    SELECT nickname FROM game_users WHERE id = p_user_id
  )
  LEFT JOIN problems p ON p.user_id IN (
    SELECT auth_user_id FROM game_users WHERE id = p_user_id
  )
  WHERE up.user_id = p_user_id
  GROUP BY up.user_id, up.total_solves, up.current_streak, up.total_comments;
  
  -- 배지 조건 확인 및 부여
  FOR badge_record IN 
    SELECT * FROM badges
    WHERE id NOT IN (
      SELECT badge_id FROM user_badges WHERE user_id = p_user_id
    )
  LOOP
    CASE badge_record.condition_type
      WHEN 'first_room' THEN
        IF user_stats.room_count >= badge_record.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, badge_record.id)
          ON CONFLICT DO NOTHING;
          
          -- 보상 지급
          UPDATE user_progress
          SET 
            xp = xp + badge_record.reward_xp,
            points = points + badge_record.reward_points
          WHERE user_id = p_user_id;
          
          awarded_count := awarded_count + 1;
        END IF;
      WHEN 'first_solve' THEN
        IF user_stats.total_solves >= badge_record.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, badge_record.id)
          ON CONFLICT DO NOTHING;
          
          UPDATE user_progress
          SET 
            xp = xp + badge_record.reward_xp,
            points = points + badge_record.reward_points
          WHERE user_id = p_user_id;
          
          awarded_count := awarded_count + 1;
        END IF;
      WHEN 'solve_count' THEN
        IF user_stats.total_solves >= badge_record.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, badge_record.id)
          ON CONFLICT DO NOTHING;
          
          UPDATE user_progress
          SET 
            xp = xp + badge_record.reward_xp,
            points = points + badge_record.reward_points
          WHERE user_id = p_user_id;
          
          awarded_count := awarded_count + 1;
        END IF;
      WHEN 'streak_days' THEN
        IF user_stats.current_streak >= badge_record.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, badge_record.id)
          ON CONFLICT DO NOTHING;
          
          UPDATE user_progress
          SET 
            xp = xp + badge_record.reward_xp,
            points = points + badge_record.reward_points
          WHERE user_id = p_user_id;
          
          awarded_count := awarded_count + 1;
        END IF;
      WHEN 'comment_count' THEN
        IF user_stats.total_comments >= badge_record.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id)
          VALUES (p_user_id, badge_record.id)
          ON CONFLICT DO NOTHING;
          
          UPDATE user_progress
          SET 
            xp = xp + badge_record.reward_xp,
            points = points + badge_record.reward_points
          WHERE user_id = p_user_id;
          
          awarded_count := awarded_count + 1;
        END IF;
    END CASE;
  END LOOP;
  
  RETURN awarded_count;
END;
$$;

-- 7. 시즌 랭킹 계산 함수
CREATE OR REPLACE FUNCTION calculate_season_rankings(p_season_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- 시즌 랭킹 업데이트
  WITH ranked_users AS (
    SELECT 
      up.user_id,
      up.points as total_points,
      up.xp as total_xp,
      up.total_solves as solve_count,
      up.current_streak as streak_days,
      ROW_NUMBER() OVER (ORDER BY up.points DESC, up.xp DESC) as rank
    FROM user_progress up
  )
  INSERT INTO season_rankings (season_id, user_id, total_points, total_xp, solve_count, streak_days, rank)
  SELECT 
    p_season_id,
    user_id,
    total_points,
    total_xp,
    solve_count,
    streak_days,
    rank
  FROM ranked_users
  ON CONFLICT (season_id, user_id) DO UPDATE
  SET 
    total_points = EXCLUDED.total_points,
    total_xp = EXCLUDED.total_xp,
    solve_count = EXCLUDED.solve_count,
    streak_days = EXCLUDED.streak_days,
    rank = EXCLUDED.rank,
    updated_at = NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- RLS 정책
ALTER TABLE season_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Anyone can read season rankings" ON season_rankings;
DROP POLICY IF EXISTS "Anyone can read badges" ON badges;
DROP POLICY IF EXISTS "Anyone can read user badges" ON user_badges;

-- 모든 사용자가 읽을 수 있도록 설정
CREATE POLICY "Anyone can read season rankings" ON season_rankings FOR SELECT USING (true);
CREATE POLICY "Anyone can read badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Anyone can read user badges" ON user_badges FOR SELECT USING (true);

-- 권한 부여
GRANT SELECT ON season_rankings, badges, user_badges TO authenticated;
GRANT SELECT ON season_rankings, badges, user_badges TO anon;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION check_and_award_badges(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_season_rankings(TEXT) TO authenticated;

