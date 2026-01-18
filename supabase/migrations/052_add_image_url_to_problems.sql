-- problems 테이블에 image_url 컬럼 추가
-- 이미지 게임 등에서 문제 썸네일로 사용

ALTER TABLE problems ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 인덱스 생성 (이미지가 있는 문제를 빠르게 찾기 위해)
CREATE INDEX IF NOT EXISTS idx_problems_image_url ON problems(image_url) WHERE image_url IS NOT NULL;

