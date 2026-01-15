-- 댓글에 스포일러 표시 기능 추가

-- 1. problem_comments 테이블에 is_spoiler 컬럼 추가
ALTER TABLE problem_comments
ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN DEFAULT false NOT NULL;

-- 2. 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_problem_comments_is_spoiler 
ON problem_comments(is_spoiler) 
WHERE is_spoiler = true;

-- 3. 주석 추가
COMMENT ON COLUMN problem_comments.is_spoiler IS 
'스포일러 여부. true이면 댓글이 블라인드 처리되어 클릭해야 볼 수 있습니다.';

