-- problems 테이블에 explanation(해설/배경지식) 컬럼 추가
-- AdSense 콘텐츠 품질 강화: 300~500단어 해설로 페이지당 고유 텍스트 확보

ALTER TABLE problems ADD COLUMN IF NOT EXISTS explanation TEXT;

COMMENT ON COLUMN problems.explanation IS '해설/배경지식 (AdSense 품질 강화용, 300~500단어 권장)';
