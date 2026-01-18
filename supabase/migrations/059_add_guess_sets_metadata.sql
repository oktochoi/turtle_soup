-- guess_sets 테이블에 조회수, 난이도, 상태 컬럼 추가

-- view_count 컬럼 추가 (조회수)
ALTER TABLE guess_sets ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;

-- difficulty 컬럼 추가 (난이도 평균 별점)
ALTER TABLE guess_sets ADD COLUMN IF NOT EXISTS difficulty_rating NUMERIC(3,2) DEFAULT 0;

-- status 컬럼 추가 (관리자 채택 여부)
ALTER TABLE guess_sets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'featured', 'archived'));

-- 인덱스 추가 (조회수, 상태 정렬용)
CREATE INDEX IF NOT EXISTS idx_guess_sets_view_count ON guess_sets(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_guess_sets_status ON guess_sets(status);

