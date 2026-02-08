-- 밸런스 게임 선택지에 이미지 URL 지원
ALTER TABLE balance_game_options ADD COLUMN IF NOT EXISTS image_url TEXT;

-- text는 이미지만 있을 수 있으므로 빈 문자열 허용 (기존 NOT NULL 유지)
COMMENT ON COLUMN balance_game_options.image_url IS '선택지 이미지 URL. 텍스트 없이 이미지만 사용 가능.';
