-- ============================================
-- rooms 테이블에 lang 컬럼 추가
-- ============================================

-- lang 컬럼 추가 (기본값 'ko')
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ko';

-- lang 컬럼에 CHECK 제약 조건 추가 (ko 또는 en만 허용)
ALTER TABLE rooms 
DROP CONSTRAINT IF EXISTS rooms_lang_check;

ALTER TABLE rooms 
ADD CONSTRAINT rooms_lang_check CHECK (lang IN ('ko', 'en'));

-- lang 컬럼에 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_rooms_lang ON rooms(lang);

-- 기존 데이터가 있으면 모두 'ko'로 설정
UPDATE rooms SET lang = 'ko' WHERE lang IS NULL OR lang NOT IN ('ko', 'en');

