-- problems 테이블에 original_author 컬럼 추가 (선택사항)
-- 원작자가 있는 문제의 경우 원작자 이름을 저장

ALTER TABLE problems 
ADD COLUMN IF NOT EXISTS original_author TEXT;

-- 인덱스 추가 (선택사항, 원작자로 검색할 경우)
CREATE INDEX IF NOT EXISTS idx_problems_original_author ON problems(original_author) WHERE original_author IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN problems.original_author IS '원작자 이름 (선택사항). 문제가 다른 출처에서 가져온 경우 원작자를 명시합니다.';

