-- 방 자동 정리 확장: 라이어/마피아 방(LOBBY, PLAYING, FINISHED) 포함
-- 기존: status='active'만 대상 → 확장: active, LOBBY, PLAYING, FINISHED 모두 대상

CREATE OR REPLACE FUNCTION cleanup_inactive_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- 30분 이상 활동이 없는 방을 status='done'으로 변경 (트리거가 삭제 실행)
  -- 바다거북스프(active), 라이어(LOBBY/PLAYING/FINISHED), 마피아(LOBBY/PLAYING/FINISHED) 모두 대상
  UPDATE rooms r
  SET status = 'done'
  WHERE r.status IN ('active', 'LOBBY', 'PLAYING', 'FINISHED')
    AND (
      (r.last_activity_at IS NOT NULL AND r.last_activity_at < NOW() - INTERVAL '30 minutes')
      OR
      (r.last_activity_at IS NULL AND r.created_at < NOW() - INTERVAL '30 minutes')
    );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_inactive_rooms() TO anon;
GRANT EXECUTE ON FUNCTION cleanup_inactive_rooms() TO authenticated;

COMMENT ON FUNCTION cleanup_inactive_rooms() IS 
  '30분 이상 활동이 없으면 방을 자동 삭제. 바다거북스프/라이어/마피아 방 모두 대상.';
