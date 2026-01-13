-- ============================================
-- 랭킹 기능을 위한 마이그레이션 SQL
-- ============================================
-- 이 파일의 내용을 Supabase 대시보드의 SQL Editor에서 실행하세요.
-- ============================================

-- 0. 멀티플레이 관련 테이블 생성 (guesses 뷰를 위해 필요)

-- Rooms 테이블
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  story TEXT NOT NULL,
  truth TEXT NOT NULL,
  max_questions INTEGER DEFAULT 30 NOT NULL,
  host_nickname TEXT NOT NULL,
  password TEXT NULL,
  game_ended BOOLEAN DEFAULT FALSE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'done')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Guesses 테이블 (멀티플레이 정답 통계 뷰를 위해 필요)
CREATE TABLE IF NOT EXISTS guesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  judged BOOLEAN DEFAULT FALSE NOT NULL,
  correct BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_guesses_room_code ON guesses(room_code);

-- 1. problems 테이블이 없으면 생성 (최소 구조)
CREATE TABLE IF NOT EXISTS problems (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium' NOT NULL,
  tags TEXT[] DEFAULT '{}' NOT NULL,
  author TEXT NOT NULL,
  admin_password TEXT NOT NULL,
  like_count INTEGER DEFAULT 0 NOT NULL,
  comment_count INTEGER DEFAULT 0 NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. problems 테이블에 author 컬럼이 없으면 추가 (기존 테이블에 없을 수 있음)
ALTER TABLE problems 
  ADD COLUMN IF NOT EXISTS author TEXT;

-- author 컬럼이 NULL인 경우 기본값 설정
UPDATE problems 
SET author = '알 수 없음' 
WHERE author IS NULL;

-- author 컬럼을 NOT NULL로 변경 (기존 데이터가 있으면)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'problems' AND column_name = 'author' AND is_nullable = 'YES') THEN
    ALTER TABLE problems ALTER COLUMN author SET NOT NULL;
  END IF;
END $$;

-- 3. problems 테이블에 user_id 컬럼 추가
ALTER TABLE problems 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. problem_likes 테이블이 없으면 생성 (기존 스키마와 호환)
CREATE TABLE IF NOT EXISTS problem_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_identifier TEXT, -- 기존 호환성 유지
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. problem_likes 테이블에 user_id 컬럼 추가
ALTER TABLE problem_likes 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. 기존 UNIQUE 제약 조건 제거 (user_identifier 기반, 존재하는 경우에만)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'problem_likes_problem_id_user_identifier_key'
  ) THEN
    ALTER TABLE problem_likes 
      DROP CONSTRAINT problem_likes_problem_id_user_identifier_key;
  END IF;
END $$;

-- 6. 새로운 UNIQUE 제약 조건 추가 (user_id 기반)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'problem_likes_problem_id_user_id_key'
  ) THEN
    ALTER TABLE problem_likes 
      DROP CONSTRAINT problem_likes_problem_id_user_id_key;
  END IF;
END $$;

ALTER TABLE problem_likes 
  ADD CONSTRAINT problem_likes_problem_id_user_id_key UNIQUE(problem_id, user_id);

-- 7. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_likes_user_id ON problem_likes(user_id);

-- 8. problems 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_problems_tags ON problems USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);

-- 9. problem_likes 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_problem_likes_problem_id ON problem_likes(problem_id);

-- 10. 멀티플레이 정답 통계 뷰 생성
CREATE OR REPLACE VIEW multiplayer_correct_answers AS
SELECT 
  nickname,
  COUNT(*) as correct_count,
  MAX(created_at) as last_correct_at
FROM guesses
WHERE correct = true AND judged = true
GROUP BY nickname
ORDER BY correct_count DESC, last_correct_at DESC;

-- 11. 문제 좋아요 랭킹 뷰 생성
CREATE OR REPLACE VIEW problem_author_likes AS
SELECT 
  p.user_id,
  p.author,
  COUNT(DISTINCT pl.id) as total_likes,
  COUNT(DISTINCT p.id) as problem_count
FROM problems p
LEFT JOIN problem_likes pl ON p.id = pl.problem_id
WHERE p.user_id IS NOT NULL
GROUP BY p.user_id, p.author
ORDER BY total_likes DESC, problem_count DESC;

-- 12. RLS 정책 설정 (테이블이 새로 생성된 경우)
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;

-- problems 테이블 정책 생성
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'problems' AND policyname = 'Anyone can read problems'
  ) THEN
    CREATE POLICY "Anyone can read problems" ON problems
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'problems' AND policyname = 'Anyone can create problems'
  ) THEN
    CREATE POLICY "Anyone can create problems" ON problems
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE problem_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_likes ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 없으면 생성
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'problem_likes' AND policyname = 'Anyone can read problem_likes'
  ) THEN
    CREATE POLICY "Anyone can read problem_likes" ON problem_likes
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'problem_likes' AND policyname = 'Anyone can create problem_likes'
  ) THEN
    CREATE POLICY "Anyone can create problem_likes" ON problem_likes
      FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 13. 좋아요 수를 자동으로 업데이트하는 트리거 함수 (없으면 생성)
CREATE OR REPLACE FUNCTION update_problem_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problems SET like_count = like_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problems SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.problem_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (없으면 생성)
DROP TRIGGER IF EXISTS trigger_update_problem_like_count ON problem_likes;
CREATE TRIGGER trigger_update_problem_like_count
  AFTER INSERT OR DELETE ON problem_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_problem_like_count();

-- 14. 뷰에 대한 읽기 권한 부여
GRANT SELECT ON multiplayer_correct_answers TO anon;
GRANT SELECT ON multiplayer_correct_answers TO authenticated;
GRANT SELECT ON problem_author_likes TO anon;
GRANT SELECT ON problem_author_likes TO authenticated;

