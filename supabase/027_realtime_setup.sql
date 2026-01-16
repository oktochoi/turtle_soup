-- Realtime 활성화 및 최적화
-- Supabase Realtime을 사용하기 위해 테이블을 publication에 추가

-- 기존 publication 확인 및 추가
DO $$
BEGIN
  -- rooms 테이블
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
  END IF;

  -- players 테이블
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE players;
  END IF;

  -- room_chats 테이블
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'room_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE room_chats;
  END IF;

  -- questions 테이블
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE questions;
  END IF;

  -- guesses 테이블
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'guesses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE guesses;
  END IF;
END $$;

-- Realtime을 위한 인덱스 최적화
CREATE INDEX IF NOT EXISTS idx_room_chats_room_code_created_at ON room_chats(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_room_code_joined_at ON players(room_code, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_room_code_created_at ON questions(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guesses_room_code_created_at ON guesses(room_code, created_at DESC);

-- rooms 테이블에 last_activity_at 추가 (실시간 업데이트용)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- last_activity_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_room_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- room_chats, questions, guesses가 변경될 때 rooms.last_activity_at 업데이트
  IF TG_TABLE_NAME = 'room_chats' THEN
    UPDATE rooms SET last_activity_at = NOW() WHERE code = NEW.room_code;
  ELSIF TG_TABLE_NAME = 'questions' THEN
    UPDATE rooms SET last_activity_at = NOW() WHERE code = NEW.room_code;
  ELSIF TG_TABLE_NAME = 'guesses' THEN
    UPDATE rooms SET last_activity_at = NOW() WHERE code = NEW.room_code;
  ELSIF TG_TABLE_NAME = 'players' THEN
    UPDATE rooms SET last_activity_at = NOW() WHERE code = NEW.room_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_room_last_activity_chats ON room_chats;
CREATE TRIGGER trigger_update_room_last_activity_chats
  AFTER INSERT ON room_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_room_last_activity();

DROP TRIGGER IF EXISTS trigger_update_room_last_activity_questions ON questions;
CREATE TRIGGER trigger_update_room_last_activity_questions
  AFTER INSERT ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_room_last_activity();

DROP TRIGGER IF EXISTS trigger_update_room_last_activity_guesses ON guesses;
CREATE TRIGGER trigger_update_room_last_activity_guesses
  AFTER INSERT ON guesses
  FOR EACH ROW
  EXECUTE FUNCTION update_room_last_activity();

DROP TRIGGER IF EXISTS trigger_update_room_last_activity_players ON players;
CREATE TRIGGER trigger_update_room_last_activity_players
  AFTER INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_room_last_activity();

