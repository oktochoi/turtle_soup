-- 방 자동 정리 기능 업데이트
-- 생성 후 30분 동안 대화(채팅)가 없으면 자동으로 삭제

-- 1. 기존 cleanup_inactive_rooms 함수 수정
-- 30분 동안 대화가 없으면 삭제하는 함수로 변경
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 생성 후 30분이 지났고, 채팅 메시지가 하나도 없는 방을 찾아서 status를 'done'으로 변경
  -- 이렇게 하면 기존의 delete_room_when_done 트리거가 실행되어 방이 삭제됨
  UPDATE rooms r
  SET status = 'done'
  WHERE r.status = 'active'
    AND r.game_ended = FALSE
    AND r.created_at < NOW() - INTERVAL '30 minutes'
    AND NOT EXISTS (
      -- 해당 방에 채팅 메시지가 하나라도 있으면 제외
      SELECT 1 FROM room_chats rc 
      WHERE rc.room_code = r.code
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 주석 업데이트
COMMENT ON FUNCTION cleanup_inactive_rooms() IS 
  '생성 후 30분 동안 대화(채팅)가 없으면 방을 자동으로 삭제합니다.';

-- 3. 기존 cron job이 있다면 업데이트 (선택사항)
-- 주의: Supabase에서 pg_cron이 활성화되어 있어야 함
-- 기존 cron job 제거 후 재생성
-- SELECT cron.unschedule('cleanup-inactive-rooms');
-- SELECT cron.schedule('cleanup-inactive-rooms', '*/5 * * * *', 'SELECT cleanup_inactive_rooms();');
-- 매 5분마다 실행하여 30분 경과한 방을 정리

