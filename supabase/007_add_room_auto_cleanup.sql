-- 방 자동 정리 기능 추가
-- 1시간 동안 활동이 없으면 방을 자동으로 제거

-- 1. rooms 테이블에 last_activity_at 컬럼 추가
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 기존 방의 last_activity_at을 created_at으로 설정
UPDATE rooms 
SET last_activity_at = created_at 
WHERE last_activity_at IS NULL;

-- 2. 방 활동 업데이트 함수
CREATE OR REPLACE FUNCTION update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- 질문, 추측, 채팅이 생성될 때마다 해당 방의 last_activity_at 업데이트
  UPDATE rooms 
  SET last_activity_at = NOW() 
  WHERE code = NEW.room_code;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 질문 생성 시 활동 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_update_room_activity_on_question ON questions;
CREATE TRIGGER trigger_update_room_activity_on_question
  AFTER INSERT ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_room_activity();

-- 4. 추측 생성 시 활동 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_update_room_activity_on_guess ON guesses;
CREATE TRIGGER trigger_update_room_activity_on_guess
  AFTER INSERT ON guesses
  FOR EACH ROW
  EXECUTE FUNCTION update_room_activity();

-- 5. 채팅 생성 시 활동 업데이트 트리거
DROP TRIGGER IF EXISTS trigger_update_room_activity_on_chat ON room_chats;
CREATE TRIGGER trigger_update_room_activity_on_chat
  AFTER INSERT ON room_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_room_activity();

-- 6. 플레이어 참가 시에도 활동 업데이트 (새로운 참가자가 들어올 때)
DROP TRIGGER IF EXISTS trigger_update_room_activity_on_player ON players;
CREATE TRIGGER trigger_update_room_activity_on_player
  AFTER INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_room_activity();

-- 7. 1시간 이상 활동이 없는 방을 자동으로 제거하는 함수
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 1시간(60분) 이상 활동이 없고, 게임이 종료되지 않은 방을 찾아서 status를 'done'으로 변경
  -- 이렇게 하면 기존의 delete_room_when_done 트리거가 실행되어 방이 삭제됨
  UPDATE rooms
  SET status = 'done'
  WHERE status = 'active'
    AND game_ended = FALSE
    AND last_activity_at < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 8. pg_cron을 사용하여 주기적으로 실행 (Supabase에서 pg_cron이 활성화되어 있다면)
-- 주의: Supabase에서는 pg_cron이 기본적으로 활성화되어 있지 않을 수 있으므로,
-- 클라이언트에서도 주기적으로 호출할 수 있도록 API 엔드포인트를 만들어야 함

-- 매 10분마다 실행 (pg_cron이 활성화된 경우)
-- SELECT cron.schedule('cleanup-inactive-rooms', '*/10 * * * *', 'SELECT cleanup_inactive_rooms();');

