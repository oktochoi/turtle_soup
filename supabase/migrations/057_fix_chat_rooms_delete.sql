-- chat_rooms 삭제 문제 해결
-- 관리자 및 service_role이 삭제할 수 있도록 정책 수정

-- 기존 삭제 정책 삭제
DROP POLICY IF EXISTS "Anyone can delete chat_rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Enable delete for all users" ON chat_rooms;

-- 관리자 및 service_role이 삭제할 수 있도록 정책 재생성
-- Supabase 대시보드에서도 삭제 가능하도록 설정
CREATE POLICY "Enable delete for all users" ON chat_rooms
  FOR DELETE 
  USING (true);

-- 트리거 함수 수정: DELETE 시 room_id가 이미 삭제된 경우를 처리
CREATE OR REPLACE FUNCTION create_chat_room_system_message()
RETURNS TRIGGER AS $$
DECLARE
  system_nickname TEXT := 'SYSTEM';
  system_message TEXT;
  room_exists BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 입장 메시지
    system_message := NEW.nickname || '님이 입장했습니다.';
    
    INSERT INTO chat_room_messages (room_id, user_id, nickname, message)
    VALUES (NEW.room_id, NULL, system_nickname, system_message);
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- room_id가 여전히 존재하는지 확인 (방이 삭제되지 않았을 때만 메시지 생성)
    SELECT EXISTS(SELECT 1 FROM chat_rooms WHERE id = OLD.room_id) INTO room_exists;
    
    IF room_exists THEN
      -- 퇴장 메시지
      system_message := OLD.nickname || '님이 퇴장했습니다.';
      
      INSERT INTO chat_room_messages (room_id, user_id, nickname, message)
      VALUES (OLD.room_id, NULL, system_nickname, system_message);
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

