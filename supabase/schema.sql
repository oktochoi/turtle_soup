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

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_players_room_code ON players(room_code);
CREATE INDEX IF NOT EXISTS idx_questions_room_code ON questions(room_code);
CREATE INDEX IF NOT EXISTS idx_guesses_room_code ON guesses(room_code);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;

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

-- Realtime 활성화 (Supabase Realtime을 사용하기 위해 테이블을 publication에 추가)
-- 참고: Supabase 대시보드에서도 설정할 수 있습니다.
-- Database > Replication 메뉴에서 각 테이블의 Realtime을 활성화하세요.
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
ALTER PUBLICATION supabase_realtime ADD TABLE guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

