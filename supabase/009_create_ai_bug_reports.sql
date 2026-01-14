-- AI 버그 리포트 수집 테이블
-- AI가 잘못 판단한 경우를 수집하여 개선에 활용

CREATE TABLE IF NOT EXISTS ai_bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_identifier TEXT, -- 게스트 사용자 식별자
  
  -- 버그 유형
  bug_type TEXT NOT NULL CHECK (bug_type IN (
    'wrong_answer',      -- 정답인데 오답으로 판단
    'wrong_yes_no',      -- 예여야 하는데 아니요로 판단 (또는 그 반대)
    'wrong_irrelevant',  -- 관련 있는데 무관으로 판단 (또는 그 반대)
    'wrong_similarity',  -- 유사도 계산 오류
    'other'              -- 기타
  )),
  
  -- 질문/답변 정보
  question_text TEXT NOT NULL,           -- 사용자가 입력한 질문
  ai_suggested_answer TEXT NOT NULL,     -- AI가 제안한 답변 (yes/no/irrelevant/decisive)
  expected_answer TEXT,                  -- 사용자가 기대한 답변 (선택사항)
  user_answer TEXT,                     -- 사용자가 입력한 정답 추측 (선택사항)
  correct_answer TEXT,                  -- 문제의 실제 정답
  
  -- 추가 정보
  similarity_score NUMERIC,             -- 유사도 점수 (있는 경우)
  problem_content TEXT,                 -- 문제 내용 (스냅샷)
  hints TEXT[],                         -- 힌트 (있는 경우)
  language TEXT DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  
  -- 상태
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'fixed', 'rejected')),
  admin_notes TEXT,                     -- 관리자 메모
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_problem_id ON ai_bug_reports(problem_id);
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_user_id ON ai_bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_status ON ai_bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_created_at ON ai_bug_reports(created_at DESC);

-- RLS 정책 설정
ALTER TABLE ai_bug_reports ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 버그 리포트를 읽을 수 있도록 설정 (자신의 리포트만)
CREATE POLICY "Users can read their own bug reports" ON ai_bug_reports
  FOR SELECT USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- 모든 사용자가 버그 리포트를 생성할 수 있도록 설정
CREATE POLICY "Anyone can create bug reports" ON ai_bug_reports
  FOR INSERT WITH CHECK (true);

-- 작성자만 자신의 버그 리포트를 업데이트할 수 있도록 설정
CREATE POLICY "Users can update their own bug reports" ON ai_bug_reports
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    user_id IS NULL
  );

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_ai_bug_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_bug_reports_updated_at
  BEFORE UPDATE ON ai_bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_bug_reports_updated_at();

