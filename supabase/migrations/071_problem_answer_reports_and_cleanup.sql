-- 답변 신고, user_id null 자동 삭제
-- 1. problem_answer_reports: 답변 신고
-- 2. user_id null인 답변 자동 삭제 (트리거 + 정기 정리)

-- 1. 답변 신고 테이블
CREATE TABLE IF NOT EXISTS problem_answer_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES problem_user_answers(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('spam', 'harassment', 'inappropriate_content', 'other')),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(answer_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_answer_reports_answer_id ON problem_answer_reports(answer_id);
CREATE INDEX IF NOT EXISTS idx_problem_answer_reports_status ON problem_answer_reports(status);

ALTER TABLE problem_answer_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create problem_answer_reports" ON problem_answer_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_user_id);

CREATE POLICY "Users can read own problem_answer_reports" ON problem_answer_reports
  FOR SELECT USING (auth.uid() = reporter_user_id);

-- 관리자만 전체 조회/수정 가능 (users.is_admin)
CREATE POLICY "Admins can manage problem_answer_reports" ON problem_answer_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- 2. user_id null 자동 삭제 함수
CREATE OR REPLACE FUNCTION cleanup_problem_user_answers_null_user()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM problem_user_answers
    WHERE user_id IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

-- 기존 user_id null 레코드 즉시 삭제
SELECT cleanup_problem_user_answers_null_user();

-- pg_cron으로 매일 정리 (pg_cron 확장이 있는 경우)
DO $cron_block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-problem-answers-null-user',
      '0 3 * * *',  -- 매일 새벽 3시
      'SELECT cleanup_problem_user_answers_null_user()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;  -- pg_cron 없거나 job 중복 시 무시
END $cron_block$;
