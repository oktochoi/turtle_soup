-- 알림 시스템 테이블 생성
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('comment_on_problem', 'comment_on_post', 'reply_to_comment')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- 알림 클릭 시 이동할 링크 (예: /ko/problem/123, /ko/community/456)
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 추가 (읽지 않은 알림 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- RLS 정책
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 알림을 읽음 처리 가능
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- 시스템은 알림 생성 가능 (서비스 역할 사용)
-- 참고: 실제 알림 생성은 서버 사이드에서 service_role 키로 수행

