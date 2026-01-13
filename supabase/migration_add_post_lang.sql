-- ============================================
-- posts 테이블에 lang 컬럼 추가
-- ============================================

-- lang 컬럼 추가 (기본값 'ko')
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ko';

-- lang 컬럼에 CHECK 제약 조건 추가 (ko 또는 en만 허용)
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS posts_lang_check;

ALTER TABLE posts 
ADD CONSTRAINT posts_lang_check CHECK (lang IN ('ko', 'en'));

-- lang 컬럼에 인덱스 추가 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_posts_lang ON posts(lang);

-- 기존 데이터가 있으면 모두 'ko'로 설정
UPDATE posts SET lang = 'ko' WHERE lang IS NULL OR lang NOT IN ('ko', 'en');

