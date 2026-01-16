-- 버그 리포트 자동 학습 파이프라인: DB Trigger + Queue 시스템

-- 1. AI 학습 큐 테이블
CREATE TABLE IF NOT EXISTS ai_learning_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_report_id UUID REFERENCES ai_bug_reports(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')) NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=높음, 10=낮음
  retry_count INTEGER DEFAULT 0 NOT NULL,
  max_retries INTEGER DEFAULT 3 NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_queue_status ON ai_learning_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_learning_queue_bug_report_id ON ai_learning_queue(bug_report_id);

-- 2. 버그 리포트 INSERT 시 자동으로 큐에 추가하는 트리거
CREATE OR REPLACE FUNCTION queue_bug_report_for_learning()
RETURNS TRIGGER AS $$
BEGIN
  -- ignore_for_learning = false이고 studied = false인 경우만 큐에 추가
  IF NEW.ignore_for_learning = false AND (NEW.studied IS NULL OR NEW.studied = false) THEN
    INSERT INTO ai_learning_queue (bug_report_id, status, priority)
    VALUES (NEW.id, 'pending', 5)
    ON CONFLICT DO NOTHING; -- 중복 방지
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_queue_bug_report_for_learning ON ai_bug_reports;
CREATE TRIGGER trigger_queue_bug_report_for_learning
  AFTER INSERT ON ai_bug_reports
  FOR EACH ROW
  WHEN (NEW.ignore_for_learning = false AND (NEW.studied IS NULL OR NEW.studied = false))
  EXECUTE FUNCTION queue_bug_report_for_learning();

-- 3. 큐에서 다음 작업을 가져오는 함수 (Edge Function에서 호출)
CREATE OR REPLACE FUNCTION get_next_learning_job(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  bug_report_id UUID,
  status TEXT,
  priority INTEGER,
  retry_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- pending 상태의 작업을 우선순위와 생성 시간 순으로 가져오기
  RETURN QUERY
  SELECT 
    q.id,
    q.bug_report_id,
    q.status,
    q.priority,
    q.retry_count
  FROM ai_learning_queue q
  WHERE q.status = 'pending'
    AND q.retry_count < q.max_retries
  ORDER BY q.priority ASC, q.created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED; -- 동시 처리 방지
END;
$$;

-- 4. 작업 상태 업데이트 함수
CREATE OR REPLACE FUNCTION update_learning_job_status(
  job_id UUID,
  new_status TEXT,
  error_msg TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ai_learning_queue
  SET 
    status = new_status,
    error_message = error_msg,
    processed_at = CASE WHEN new_status = 'processing' THEN NOW() ELSE processed_at END,
    completed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
    retry_count = CASE WHEN new_status = 'failed' THEN retry_count + 1 ELSE retry_count END
  WHERE id = job_id;
END;
$$;

-- 5. 실패한 작업 재시도 함수
CREATE OR REPLACE FUNCTION retry_failed_learning_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retried_count INTEGER := 0;
BEGIN
  -- 실패한 작업 중 재시도 가능한 것들을 pending으로 변경
  UPDATE ai_learning_queue
  SET status = 'pending',
      error_message = NULL
  WHERE status = 'failed'
    AND retry_count < max_retries
    AND created_at > NOW() - INTERVAL '24 hours' -- 24시간 이내의 작업만 재시도
  RETURNING id INTO retried_count;
  
  RETURN retried_count;
END;
$$;

-- RLS 정책
ALTER TABLE ai_learning_queue ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 (이미 존재할 수 있음)
DROP POLICY IF EXISTS "Anyone can read learning queue" ON ai_learning_queue;
DROP POLICY IF EXISTS "System can insert learning queue" ON ai_learning_queue;
DROP POLICY IF EXISTS "Authenticated can update learning queue" ON ai_learning_queue;

-- 모든 사용자가 읽을 수 있도록 설정 (통계용)
CREATE POLICY "Anyone can read learning queue" ON ai_learning_queue
  FOR SELECT USING (true);

-- 인증된 사용자만 큐 작업을 생성할 수 있도록 설정 (트리거를 통해서만)
CREATE POLICY "System can insert learning queue" ON ai_learning_queue
  FOR INSERT WITH CHECK (true);

-- 인증된 사용자만 큐 작업을 업데이트할 수 있도록 설정
CREATE POLICY "Authenticated can update learning queue" ON ai_learning_queue
  FOR UPDATE USING (true);

-- 권한 부여
GRANT SELECT, INSERT, UPDATE ON ai_learning_queue TO authenticated;
GRANT SELECT ON ai_learning_queue TO anon;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION get_next_learning_job(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_learning_job_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_learning_jobs() TO authenticated;

