-- 레벨/경험치/칭호/업적/포인트 시스템 마이그레이션
-- 바다거북스프 게임의 진행도 시스템

-- 1. Users 테이블 (기존 auth.users와 별도로 게임용 유저 정보)
CREATE TABLE IF NOT EXISTS game_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL,
  guest_id TEXT UNIQUE, -- localStorage 기반 guest_id (로그인 없는 유저용)
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Supabase Auth 연결 시
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. User Progress 테이블 (레벨, XP, 포인트, 스트릭)
CREATE TABLE IF NOT EXISTS user_progress (
  user_id UUID PRIMARY KEY REFERENCES game_users(id) ON DELETE CASCADE,
  level INTEGER DEFAULT 1 NOT NULL,
  xp INTEGER DEFAULT 0 NOT NULL,
  points INTEGER DEFAULT 0 NOT NULL,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  best_streak INTEGER DEFAULT 0 NOT NULL,
  last_participation_date DATE,
  selected_title_id INTEGER,
  total_solves INTEGER DEFAULT 0 NOT NULL,
  total_participations INTEGER DEFAULT 0 NOT NULL,
  total_comments INTEGER DEFAULT 0 NOT NULL,
  total_posts INTEGER DEFAULT 0 NOT NULL,
  nohint_solves INTEGER DEFAULT 0 NOT NULL,
  under3q_solves INTEGER DEFAULT 0 NOT NULL,
  daily_comment_xp INTEGER DEFAULT 0 NOT NULL, -- 하루 댓글 XP (최대 40)
  daily_post_xp INTEGER DEFAULT 0 NOT NULL, -- 하루 게시글 XP (최대 50)
  daily_xp_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Titles 테이블 (칭호)
CREATE TABLE IF NOT EXISTS titles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  unlock_type TEXT NOT NULL CHECK (unlock_type IN ('level', 'achievement', 'streak', 'solve_count', 'manual')),
  unlock_value INTEGER,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. User Titles 테이블 (사용자가 획득한 칭호)
CREATE TABLE IF NOT EXISTS user_titles (
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE,
  title_id INTEGER REFERENCES titles(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, title_id)
);

-- 5. Achievements 테이블 (업적)
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'streak_gte', 'daily_participation_count_gte', 'solve_count_gte',
    'nohint_solve_count_gte', 'under3q_solve_count_gte', 'level_gte',
    'total_comments_gte', 'total_posts_gte'
  )),
  condition_value INTEGER NOT NULL,
  reward_xp INTEGER DEFAULT 0 NOT NULL,
  reward_points INTEGER DEFAULT 0 NOT NULL,
  reward_title_id INTEGER REFERENCES titles(id) ON DELETE SET NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. User Achievements 테이블 (사용자가 달성한 업적)
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE,
  achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

-- 7. XP Events 테이블 (XP 획득 이력 - 선택사항, 디버깅용)
CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  xp_gained INTEGER NOT NULL,
  points_gained INTEGER DEFAULT 0 NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_game_users_guest_id ON game_users(guest_id);
CREATE INDEX IF NOT EXISTS idx_game_users_auth_user_id ON game_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_level ON user_progress(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_titles_user_id ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON xp_events(created_at DESC);

-- RLS 정책 설정
ALTER TABLE game_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 설정 (공개 정보)
CREATE POLICY "Anyone can read game_users" ON game_users
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read user_progress" ON user_progress
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read titles" ON titles
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read user_titles" ON user_titles
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read achievements" ON achievements
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read user_achievements" ON user_achievements
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read xp_events" ON xp_events
  FOR SELECT USING (true);

-- 인증된 사용자만 자신의 데이터를 생성/수정할 수 있도록 설정
-- (guest_id 기반 접근은 애플리케이션 레벨에서 처리)
CREATE POLICY "Users can create their own game_user" ON game_users
  FOR INSERT WITH CHECK (true); -- 애플리케이션 레벨에서 검증

CREATE POLICY "Users can update their own game_user" ON game_users
  FOR UPDATE USING (true); -- 애플리케이션 레벨에서 검증

CREATE POLICY "Users can create their own progress" ON user_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own progress" ON user_progress
  FOR UPDATE USING (true);

CREATE POLICY "Users can insert their own titles" ON user_titles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can insert their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can insert their own xp_events" ON xp_events
  FOR INSERT WITH CHECK (true);

-- 기본 칭호 데이터 삽입
INSERT INTO titles (name, description, rarity, unlock_type, unlock_value, icon) VALUES
  ('수습 탐정', '레벨 1 달성', 'common', 'level', 1, '🔍'),
  ('신입 탐정', '레벨 5 달성', 'common', 'level', 5, '🕵️'),
  ('주니어 탐정', '레벨 10 달성', 'rare', 'level', 10, '🔎'),
  ('시니어 탐정', '레벨 20 달성', 'rare', 'level', 20, '🕵️‍♂️'),
  ('마스터 탐정', '레벨 30 달성', 'epic', 'level', 30, '🕵️‍♀️'),
  ('레전드 탐정', '레벨 50 달성', 'legendary', 'level', 50, '👑'),
  ('불굴의 탐정', '연속 7일 참여', 'rare', 'streak', 7, '🔥'),
  ('불멸의 탐정', '연속 30일 참여', 'epic', 'streak', 30, '💎'),
  ('완벽주의자', '힌트 없이 5회 성공', 'rare', 'solve_count', 5, '✨'),
  ('천재 탐정', '3질문 이내 성공 1회', 'epic', 'solve_count', 1, '🧠')
ON CONFLICT (name) DO NOTHING;

-- 기본 업적 데이터 삽입
INSERT INTO achievements (name, description, rarity, condition_type, condition_value, reward_xp, reward_points, icon) VALUES
  ('첫 걸음', '첫 참여를 완료했습니다', 'common', 'daily_participation_count_gte', 1, 50, 20, '🎯'),
  ('불꽃의 시작', '연속 3일 참여', 'common', 'streak_gte', 3, 100, 50, '🔥'),
  ('일주일의 기적', '연속 7일 참여', 'rare', 'streak_gte', 7, 200, 100, '⭐'),
  ('첫 승리', '문제를 처음으로 해결했습니다', 'common', 'solve_count_gte', 1, 50, 20, '🏆'),
  ('10회 승리', '문제를 10회 해결했습니다', 'rare', 'solve_count_gte', 10, 300, 150, '🎖️'),
  ('완벽한 추리', '힌트 없이 5회 성공', 'rare', 'nohint_solve_count_gte', 5, 500, 250, '✨'),
  ('번개 같은 추리', '3질문 이내로 성공', 'epic', 'under3q_solve_count_gte', 1, 1000, 500, '⚡'),
  ('레벨 10 달성', '레벨 10에 도달했습니다', 'rare', 'level_gte', 10, 500, 250, '📈'),
  ('레벨 20 달성', '레벨 20에 도달했습니다', 'epic', 'level_gte', 20, 1000, 500, '🌟'),
  ('소통왕', '댓글을 50개 작성했습니다', 'common', 'total_comments_gte', 50, 200, 100, '💬'),
  ('작성왕', '게시글을 10개 작성했습니다', 'rare', 'total_posts_gte', 10, 400, 200, '✍️')
ON CONFLICT (name) DO NOTHING;

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_game_users_updated_at ON game_users;
CREATE TRIGGER update_game_users_updated_at
  BEFORE UPDATE ON game_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_progress_updated_at ON user_progress;
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

