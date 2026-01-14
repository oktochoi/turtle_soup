-- 유저 신고 테이블 생성
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_user_id UUID NOT NULL, -- game_users의 id를 참조 (외래키 제약은 나중에 추가 가능)
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_identifier TEXT, -- 로그인하지 않은 사용자를 위한 식별자 (예: guest_id)
  report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'harassment', 'inappropriate_content', 'fake_account', 'other')),
  reason TEXT NOT NULL,
  description TEXT, -- 상세 설명 (선택사항)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')) NOT NULL,
  admin_notes TEXT, -- 관리자 메모
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 검토한 관리자
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_user ON user_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);

-- RLS 활성화
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 신고를 생성할 수 있도록 허용
CREATE POLICY "Allow all users to create reports"
ON user_reports FOR INSERT
WITH CHECK (true);

-- 사용자가 자신의 신고만 조회할 수 있도록 허용
CREATE POLICY "Allow users to view their own reports"
ON user_reports FOR SELECT
USING (
  auth.uid() = reporter_user_id OR
  (reporter_user_id IS NULL AND reporter_identifier = current_setting('app.user_identifier', true)::text)
);

-- 관리자만 모든 신고를 조회할 수 있도록 허용
CREATE POLICY "Allow admins to view all reports"
ON user_reports FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- 관리자만 신고를 업데이트할 수 있도록 허용
CREATE POLICY "Allow admins to update reports"
ON user_reports FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_reports_updated_at
BEFORE UPDATE ON user_reports
FOR EACH ROW
EXECUTE FUNCTION update_user_reports_updated_at();

-- 중복 신고 방지 (같은 사용자가 같은 유저를 같은 이유로 반복 신고하는 것 방지)
-- 24시간 이내에 같은 유저를 같은 타입으로 신고한 경우를 체크하는 함수
CREATE OR REPLACE FUNCTION check_duplicate_report()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- 로그인한 사용자의 경우
  IF NEW.reporter_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM user_reports
    WHERE reporter_user_id = NEW.reporter_user_id
      AND reported_user_id = NEW.reported_user_id
      AND report_type = NEW.report_type
      AND created_at > NOW() - INTERVAL '24 hours';
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'You have already reported this user for the same reason within the last 24 hours.';
    END IF;
  -- 게스트 사용자의 경우
  ELSIF NEW.reporter_identifier IS NOT NULL THEN
    SELECT COUNT(*) INTO existing_count
    FROM user_reports
    WHERE reporter_identifier = NEW.reporter_identifier
      AND reported_user_id = NEW.reported_user_id
      AND report_type = NEW.report_type
      AND created_at > NOW() - INTERVAL '24 hours';
    
    IF existing_count > 0 THEN
      RAISE EXCEPTION 'You have already reported this user for the same reason within the last 24 hours.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_check_duplicate_report
BEFORE INSERT ON user_reports
FOR EACH ROW
EXECUTE FUNCTION check_duplicate_report();

