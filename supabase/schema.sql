-- Rooms 테이블
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  story TEXT NOT NULL,
  truth TEXT NOT NULL,
  max_questions INTEGER DEFAULT 30 NOT NULL,
  host_nickname TEXT NOT NULL,
  game_ended BOOLEAN DEFAULT FALSE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'done')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Players 테이블
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(room_code, nickname)
);

-- Questions 테이블
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT CHECK (answer IN ('yes', 'no', 'irrelevant')) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Guesses 테이블
CREATE TABLE IF NOT EXISTS guesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  judged BOOLEAN DEFAULT FALSE NOT NULL,
  correct BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Room Chats 테이블 (잡담 채팅)
CREATE TABLE IF NOT EXISTS room_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room_code ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_questions_room_code ON questions(room_code);
CREATE INDEX IF NOT EXISTS idx_guesses_room_code ON guesses(room_code);
CREATE INDEX IF NOT EXISTS idx_room_chats_room_code ON room_chats(room_code);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_chats ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 rooms를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read rooms" ON rooms
  FOR SELECT USING (true);

-- 모든 사용자가 rooms를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create rooms" ON rooms
  FOR INSERT WITH CHECK (true);

-- 호스트만 rooms를 업데이트할 수 있도록 설정 (실제로는 애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can update rooms" ON rooms
  FOR UPDATE USING (true);

-- 모든 사용자가 players를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read players" ON players
  FOR SELECT USING (true);

-- 모든 사용자가 players를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create players" ON players
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 questions를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read questions" ON questions
  FOR SELECT USING (true);

-- 모든 사용자가 questions를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create questions" ON questions
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 questions를 업데이트할 수 있도록 설정 (실제로는 호스트만 가능하도록 애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can update questions" ON questions
  FOR UPDATE USING (true);

-- 모든 사용자가 guesses를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read guesses" ON guesses
  FOR SELECT USING (true);

-- 모든 사용자가 guesses를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create guesses" ON guesses
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 guesses를 업데이트할 수 있도록 설정 (실제로는 호스트만 가능하도록 애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can update guesses" ON guesses
  FOR UPDATE USING (true);

-- 모든 사용자가 room_chats를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read room_chats" ON room_chats
  FOR SELECT USING (true);

-- 모든 사용자가 room_chats를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create room_chats" ON room_chats
  FOR INSERT WITH CHECK (true);

-- PostgREST가 테이블을 인식하도록 권한 부여
GRANT SELECT, INSERT ON public.room_chats TO anon;
GRANT SELECT, INSERT ON public.room_chats TO authenticated;

-- rooms 삭제 정책 추가 (트리거에서 사용)
CREATE POLICY "Anyone can delete rooms" ON rooms
  FOR DELETE USING (true);

-- status가 'done'으로 변경되면 자동으로 방과 관련 데이터를 삭제하는 트리거 함수
CREATE OR REPLACE FUNCTION delete_room_when_done()
RETURNS TRIGGER AS $$
BEGIN
  -- status가 'done'으로 변경되었을 때만 실행
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    -- CASCADE로 인해 관련된 모든 데이터(players, questions, guesses)가 자동 삭제됨
    DELETE FROM rooms WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_delete_room_when_done ON rooms;
CREATE TRIGGER trigger_delete_room_when_done
  AFTER UPDATE OF status ON rooms
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done'))
  EXECUTE FUNCTION delete_room_when_done();

-- Problems 테이블 (사용자가 만든 문제)
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

-- Problem Questions 테이블 (문제에 대한 질문들)
CREATE TABLE IF NOT EXISTS problem_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  answer TEXT CHECK (answer IN ('yes', 'no', 'irrelevant', 'decisive')) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Problem Comments 테이블 (문제에 대한 댓글)
CREATE TABLE IF NOT EXISTS problem_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Problem Likes 테이블 (좋아요)
CREATE TABLE IF NOT EXISTS problem_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- IP 주소나 쿠키 등으로 사용자 식별
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(problem_id, user_identifier)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_problems_tags ON problems USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_questions_problem_id ON problem_questions(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_comments_problem_id ON problem_comments(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_likes_problem_id ON problem_likes(problem_id);

-- RLS 정책 설정
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_likes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 problems를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read problems" ON problems
  FOR SELECT USING (true);

-- 모든 사용자가 problems를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create problems" ON problems
  FOR INSERT WITH CHECK (true);

-- 비밀번호를 알고 있는 사용자만 problems를 업데이트/삭제할 수 있도록 설정 (애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can update problems" ON problems
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete problems" ON problems
  FOR DELETE USING (true);

-- 모든 사용자가 problem_questions를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read problem_questions" ON problem_questions
  FOR SELECT USING (true);

-- 모든 사용자가 problem_questions를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create problem_questions" ON problem_questions
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 problem_questions를 업데이트할 수 있도록 설정
CREATE POLICY "Anyone can update problem_questions" ON problem_questions
  FOR UPDATE USING (true);

-- 모든 사용자가 problem_comments를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read problem_comments" ON problem_comments
  FOR SELECT USING (true);

-- 모든 사용자가 problem_comments를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create problem_comments" ON problem_comments
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 problem_likes를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read problem_likes" ON problem_likes
  FOR SELECT USING (true);

-- 모든 사용자가 problem_likes를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create problem_likes" ON problem_likes
  FOR INSERT WITH CHECK (true);

-- 좋아요 수를 자동으로 업데이트하는 트리거 함수
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

-- 댓글 수를 자동으로 업데이트하는 트리거 함수
CREATE OR REPLACE FUNCTION update_problem_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problems SET comment_count = comment_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problems SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.problem_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_problem_like_count ON problem_likes;
CREATE TRIGGER trigger_update_problem_like_count
  AFTER INSERT OR DELETE ON problem_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_problem_like_count();

DROP TRIGGER IF EXISTS trigger_update_problem_comment_count ON problem_comments;
CREATE TRIGGER trigger_update_problem_comment_count
  AFTER INSERT OR DELETE ON problem_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_problem_comment_count();

-- Problem Difficulty Ratings 테이블 (별점 투표)
CREATE TABLE IF NOT EXISTS problem_difficulty_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- LocalStorage ID 또는 session ID
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5점 별점
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(problem_id, user_identifier)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_problem_difficulty_ratings_problem_id ON problem_difficulty_ratings(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_difficulty_ratings_user_identifier ON problem_difficulty_ratings(user_identifier);

-- RLS 정책 설정
ALTER TABLE problem_difficulty_ratings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 problem_difficulty_ratings를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read problem_difficulty_ratings" ON problem_difficulty_ratings
  FOR SELECT USING (true);

-- 모든 사용자가 problem_difficulty_ratings를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create problem_difficulty_ratings" ON problem_difficulty_ratings
  FOR INSERT WITH CHECK (true);

-- 모든 사용자가 problem_difficulty_ratings를 업데이트할 수 있도록 설정
CREATE POLICY "Anyone can update problem_difficulty_ratings" ON problem_difficulty_ratings
  FOR UPDATE USING (true);

-- 평균 별점을 계산하는 함수
CREATE OR REPLACE FUNCTION get_problem_average_rating(problem_uuid UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(ROUND(AVG(rating)::NUMERIC, 2), 0)
    FROM problem_difficulty_ratings
    WHERE problem_id = problem_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 별점 개수를 반환하는 함수
CREATE OR REPLACE FUNCTION get_problem_rating_count(problem_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM problem_difficulty_ratings
    WHERE problem_id = problem_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Realtime 활성화 (Supabase Realtime을 사용하기 위해 테이블을 publication에 추가)
-- 참고: Supabase 대시보드에서도 설정할 수 있습니다.
-- Database > Replication 메뉴에서 각 테이블의 Realtime을 활성화하세요.
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE room_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE problems;
ALTER PUBLICATION supabase_realtime ADD TABLE problem_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE problem_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE problem_difficulty_ratings;

