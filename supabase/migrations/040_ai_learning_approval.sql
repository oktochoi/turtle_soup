-- AI Learning Data Approval System
-- 학습 데이터를 승인 기반으로 관리하여 자동 반영 오염 방지

-- 학습 후보 데이터 테이블
CREATE TABLE IF NOT EXISTS ai_learning_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 학습 데이터 타입
  data_type TEXT NOT NULL CHECK (data_type IN ('synonym', 'antonym', 'taxonomy', 'concept')),
  
  -- 데이터 내용
  source_token TEXT NOT NULL,
  target_token TEXT NOT NULL,
  similarity_score FLOAT, -- embedding similarity if available
  
  -- 출처 정보
  source_problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  source_bug_report_id UUID, -- references bug_reports if exists
  source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- 승인 상태
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- 메타데이터
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 승인된 학습 데이터 테이블 (빠른 조회용)
CREATE TABLE IF NOT EXISTS ai_learning_deployed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 학습 데이터 타입
  data_type TEXT NOT NULL CHECK (data_type IN ('synonym', 'antonym', 'taxonomy', 'concept')),
  
  -- 데이터 내용
  source_token TEXT NOT NULL,
  target_token TEXT NOT NULL,
  similarity_score FLOAT,
  
  -- 출처
  source_candidate_id UUID REFERENCES ai_learning_candidates(id) ON DELETE SET NULL,
  
  -- 배포 정보
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  version TEXT DEFAULT '1.0.0',
  
  -- 인덱스용
  UNIQUE(data_type, source_token, target_token)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_learning_candidates_status ON ai_learning_candidates(status);
CREATE INDEX IF NOT EXISTS idx_learning_candidates_type ON ai_learning_candidates(data_type);
CREATE INDEX IF NOT EXISTS idx_learning_candidates_source_token ON ai_learning_candidates(source_token);
CREATE INDEX IF NOT EXISTS idx_learning_deployed_type_token ON ai_learning_deployed(data_type, source_token);

-- 승인 시 자동으로 deployed 테이블에 추가하는 함수
CREATE OR REPLACE FUNCTION deploy_approved_learning()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    INSERT INTO ai_learning_deployed (
      data_type,
      source_token,
      target_token,
      similarity_score,
      source_candidate_id,
      deployed_by,
      deployed_at
    )
    VALUES (
      NEW.data_type,
      NEW.source_token,
      NEW.target_token,
      NEW.similarity_score,
      NEW.id,
      NEW.reviewed_by,
      NOW()
    )
    ON CONFLICT (data_type, source_token, target_token) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS trigger_deploy_approved_learning ON ai_learning_candidates;
CREATE TRIGGER trigger_deploy_approved_learning
  AFTER UPDATE ON ai_learning_candidates
  FOR EACH ROW
  EXECUTE FUNCTION deploy_approved_learning();

-- 승인된 데이터 조회 함수 (V10에서 사용)
CREATE OR REPLACE FUNCTION get_approved_learning_data(
  p_data_type TEXT,
  p_source_token TEXT DEFAULT NULL
)
RETURNS TABLE (
  source_token TEXT,
  target_token TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.source_token,
    d.target_token,
    d.similarity_score
  FROM ai_learning_deployed d
  WHERE d.data_type = p_data_type
    AND (p_source_token IS NULL OR d.source_token = p_source_token)
  ORDER BY d.similarity_score DESC NULLS LAST, d.deployed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RLS 정책
ALTER TABLE ai_learning_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_deployed ENABLE ROW LEVEL SECURITY;

-- 모든 사용자는 후보 데이터 조회 가능 (승인 상태 확인용)
CREATE POLICY "Anyone can view candidates"
  ON ai_learning_candidates FOR SELECT
  USING (true);

-- 관리자만 후보 데이터 생성/수정 가능
CREATE POLICY "Admins can manage candidates"
  ON ai_learning_candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- 모든 사용자는 배포된 데이터 조회 가능
CREATE POLICY "Anyone can view deployed learning"
  ON ai_learning_deployed FOR SELECT
  USING (true);

-- 관리자만 배포된 데이터 관리 가능
CREATE POLICY "Admins can manage deployed learning"
  ON ai_learning_deployed FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

