-- problems 테이블에 int_id 컬럼 추가
-- 언어별로 순차적인 정수 ID를 부여하여 다음/이전 문제 탐색에 사용

-- 1. int_id 컬럼 추가 (NULL 허용, 나중에 값 할당)
ALTER TABLE problems 
ADD COLUMN IF NOT EXISTS int_id INTEGER;

-- 2. 언어별로 int_id 할당 (기존 문제들에 대해)
-- 한국어 문제들
WITH ko_problems AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1 AS row_num
  FROM problems
  WHERE lang = 'ko'
)
UPDATE problems p
SET int_id = ko_problems.row_num
FROM ko_problems
WHERE p.id = ko_problems.id;

-- 영어 문제들
WITH en_problems AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1 AS row_num
  FROM problems
  WHERE lang = 'en'
)
UPDATE problems p
SET int_id = en_problems.row_num
FROM en_problems
WHERE p.id = en_problems.id;

-- 3. int_id에 기본값 설정 (트리거가 자동 할당하므로 NULL 허용 유지)
-- NOT NULL은 트리거가 값을 할당한 후에 설정

-- 4. 언어별로 고유 인덱스 생성 (lang, int_id 조합)
CREATE UNIQUE INDEX IF NOT EXISTS idx_problems_lang_int_id 
ON problems(lang, int_id);

-- 5. 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_problems_lang_int_id_asc 
ON problems(lang, int_id ASC);

-- 6. 새 문제 추가 시 자동으로 int_id 할당하는 함수 생성
CREATE OR REPLACE FUNCTION assign_problem_int_id()
RETURNS TRIGGER AS $$
DECLARE
  next_int_id INTEGER;
BEGIN
  -- 해당 언어의 최대 int_id + 1 계산
  SELECT COALESCE(MAX(int_id), -1) + 1
  INTO next_int_id
  FROM problems
  WHERE lang = NEW.lang;
  
  NEW.int_id := next_int_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 생성 (INSERT 전에 int_id 자동 할당)
DROP TRIGGER IF EXISTS trigger_assign_problem_int_id ON problems;
CREATE TRIGGER trigger_assign_problem_int_id
  BEFORE INSERT ON problems
  FOR EACH ROW
  EXECUTE FUNCTION assign_problem_int_id();

-- 8. int_id를 NOT NULL로 변경 (트리거가 항상 값을 할당하므로)
-- 기존 NULL 값이 있는 경우를 대비해 먼저 업데이트
UPDATE problems 
SET int_id = 0 
WHERE int_id IS NULL AND lang = 'ko';

UPDATE problems 
SET int_id = 0 
WHERE int_id IS NULL AND lang = 'en';

-- 이제 NOT NULL 제약 조건 추가
ALTER TABLE problems 
ALTER COLUMN int_id SET NOT NULL;

-- 9. 주석 추가
COMMENT ON COLUMN problems.int_id IS 
  '언어별 순차 정수 ID (0부터 시작). 다음/이전 문제 탐색에 사용됩니다.';

COMMENT ON INDEX idx_problems_lang_int_id IS 
  '언어별 int_id 고유 인덱스. 같은 언어 내에서 int_id는 고유해야 합니다.';

