-- 알림 시스템 마이그레이션

-- 1. notifications 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES game_users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'mention', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_user_id UUID REFERENCES game_users(id) ON DELETE SET NULL,
  related_problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  related_comment_id UUID,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 3. RLS 정책 설정
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 읽을 수 있음
CREATE POLICY "Users can read their own notifications" ON notifications
  FOR SELECT USING (user_id = (SELECT id FROM game_users WHERE auth_user_id = auth.uid()));

-- 모든 사용자가 알림을 생성할 수 있음 (애플리케이션 레벨에서 검증)
CREATE POLICY "Anyone can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- 사용자는 자신의 알림만 읽음 표시할 수 있음
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = (SELECT id FROM game_users WHERE auth_user_id = auth.uid()));

-- 사용자는 자신의 알림만 삭제할 수 있음
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (user_id = (SELECT id FROM game_users WHERE auth_user_id = auth.uid()));

