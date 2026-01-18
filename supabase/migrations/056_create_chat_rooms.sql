-- 잡담방 (채팅만 있는 멀티플레이 방) 테이블 생성

-- chat_rooms 테이블 (잡담방)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  host_nickname TEXT NOT NULL,
  max_members INT DEFAULT 50 NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  password TEXT NULL, -- 방 비밀번호 (NULL이면 공개방)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- chat_room_members 테이블 (참가자)
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(room_id, user_id)
);

-- chat_room_messages 테이블 (채팅 메시지)
CREATE TABLE IF NOT EXISTS chat_room_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_rooms_code ON chat_rooms(code);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_host_user_id ON chat_rooms(host_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room_id ON chat_room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_created_at ON chat_room_messages(created_at DESC);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_messages ENABLE ROW LEVEL SECURITY;

-- chat_rooms 정책
-- 모든 사용자가 공개방을 읽을 수 있음
CREATE POLICY "Anyone can read public chat_rooms" ON chat_rooms
  FOR SELECT USING (is_public = TRUE);

-- 모든 사용자가 방을 생성할 수 있음
CREATE POLICY "Anyone can create chat_rooms" ON chat_rooms
  FOR INSERT WITH CHECK (true);

-- 호스트만 방을 업데이트할 수 있음 (애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can update chat_rooms" ON chat_rooms
  FOR UPDATE USING (true);

-- 호스트만 방을 삭제할 수 있음 (애플리케이션 레벨에서 처리)
CREATE POLICY "Anyone can delete chat_rooms" ON chat_rooms
  FOR DELETE USING (true);

-- chat_room_members 정책
-- 모든 사용자가 멤버 목록을 읽을 수 있음
CREATE POLICY "Anyone can read chat_room_members" ON chat_room_members
  FOR SELECT USING (true);

-- 모든 사용자가 멤버가 될 수 있음
CREATE POLICY "Anyone can join chat_rooms" ON chat_room_members
  FOR INSERT WITH CHECK (true);

-- 본인만 자신의 멤버 정보를 삭제할 수 있음
CREATE POLICY "Users can delete their own membership" ON chat_room_members
  FOR DELETE USING (auth.uid() = user_id);

-- chat_room_messages 정책
-- 모든 사용자가 메시지를 읽을 수 있음
CREATE POLICY "Anyone can read chat_room_messages" ON chat_room_messages
  FOR SELECT USING (true);

-- 모든 사용자가 메시지를 보낼 수 있음
CREATE POLICY "Anyone can send messages" ON chat_room_messages
  FOR INSERT WITH CHECK (true);

-- 본인만 자신의 메시지를 삭제할 수 있음 (애플리케이션 레벨에서 처리)
CREATE POLICY "Users can delete their own messages" ON chat_room_messages
  FOR DELETE USING (auth.uid() = user_id);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_chat_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_rooms_updated_at();

