-- 기대한 답변(expected_answer)을 필수 필드로 변경

-- 1. 기존 NULL 값이 있는 경우 처리 (기본값 설정)
UPDATE ai_bug_reports
SET expected_answer = COALESCE(expected_answer, ai_suggested_answer, 'unknown')
WHERE expected_answer IS NULL;

-- 2. NOT NULL 제약 조건 추가
ALTER TABLE ai_bug_reports
ALTER COLUMN expected_answer SET NOT NULL;

-- 3. 기본값 설정 (혹시 모를 경우를 대비)
ALTER TABLE ai_bug_reports
ALTER COLUMN expected_answer SET DEFAULT 'unknown';

