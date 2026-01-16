-- rooms 테이블에 quiz_type 컬럼 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS quiz_type quiz_type DEFAULT 'soup';

-- 기존 방들은 모두 soup 타입으로 설정
UPDATE rooms SET quiz_type = 'soup' WHERE quiz_type IS NULL;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_rooms_quiz_type ON rooms(quiz_type);

