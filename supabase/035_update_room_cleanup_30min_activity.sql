-- 방 자동 정리 기능 업데이트
-- 30분 이상 활동이 없으면 자동으로 삭제 (last_activity_at 기준)

-- 1. cleanup_inactive_rooms 함수 수정
-- last_activity_at을 기준으로 30분 이상 활동이 없으면 삭제
CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- last_activity_at이 30분 이상 지난 활성 방을 찾아서 status를 'done'으로 변경
  -- 이렇게 하면 기존의 delete_room_when_done 트리거가 실행되어 방이 삭제됨
  UPDATE rooms r
  SET status = 'done'
  WHERE r.status = 'active'
    AND r.game_ended = FALSE
    AND (
      -- last_activity_at이 30분 이상 지났거나
      (r.last_activity_at IS NOT NULL AND r.last_activity_at < NOW() - INTERVAL '30 minutes')
      OR
      -- last_activity_at이 없고 created_at이 30분 이상 지난 경우
      (r.last_activity_at IS NULL AND r.created_at < NOW() - INTERVAL '30 minutes')
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 2. 주석 업데이트
COMMENT ON FUNCTION cleanup_inactive_rooms() IS 
  '30분 이상 활동이 없으면 방을 자동으로 삭제합니다. last_activity_at 또는 created_at 기준으로 판단합니다.';

-- 3. cron job 설정 (Supabase에서 pg_cron이 활성화되어 있어야 함)
-- 주의: 이미 cron job이 있다면 먼저 제거해야 함
-- SELECT cron.unschedule('cleanup-inactive-rooms');
-- SELECT cron.schedule('cleanup-inactive-rooms', '*/5 * * * *', 'SELECT cleanup_inactive_rooms();');
-- 매 5분마다 실행하여 30분 경과한 방을 정리

