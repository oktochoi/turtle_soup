-- UGC case moderation: pending review + problem reports

-- Extend problems.status with 'pending' (awaiting admin approval)
ALTER TABLE problems DROP CONSTRAINT IF EXISTS problems_status_check;
ALTER TABLE problems ADD CONSTRAINT problems_status_check
  CHECK (status IN ('draft', 'pending', 'published', 'featured', 'archived'));

COMMENT ON COLUMN problems.status IS 'draft|pending|published|featured|archived — pending = awaiting moderation';

-- Problem (case) reports
CREATE TABLE IF NOT EXISTS problem_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_identifier TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN (
    'spam', 'violence', 'inappropriate_content', 'copyright', 'other'
  )),
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_problem_reports_problem_id ON problem_reports(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_reports_status ON problem_reports(status);
CREATE INDEX IF NOT EXISTS idx_problem_reports_created_at ON problem_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problems_status_pending ON problems(status) WHERE status = 'pending';

ALTER TABLE problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create problem_reports" ON problem_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Reporters can read own problem_reports" ON problem_reports
  FOR SELECT USING (
    auth.uid() = reporter_user_id
    OR reporter_identifier IS NOT NULL
  );

CREATE POLICY "Admins can manage problem_reports" ON problem_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Admins can approve/reject pending cases
DROP POLICY IF EXISTS "Admins can update problems status" ON problems;
CREATE POLICY "Admins can update problems status" ON problems
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

CREATE OR REPLACE FUNCTION update_problem_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_problem_reports_updated_at ON problem_reports;
CREATE TRIGGER trigger_update_problem_reports_updated_at
  BEFORE UPDATE ON problem_reports
  FOR EACH ROW EXECUTE FUNCTION update_problem_reports_updated_at();
