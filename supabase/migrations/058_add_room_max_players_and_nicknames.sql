-- rooms 테이블에 max_players와 user_nicknames 컬럼 추가

-- max_players 컬럼 추가 (최대 인원 수, NULL이면 무제한)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT NULL;

-- user_nicknames 배열 컬럼 추가 (현재 참가자 닉네임 목록)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS user_nicknames TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 기존 방들의 user_nicknames 초기화 (players 테이블에서 가져오기)
-- 주의: 이미 참가자가 있는 방의 경우 실행하면 초기화될 수 있으므로 주의
-- UPDATE rooms SET user_nicknames = ARRAY[]::TEXT[] WHERE user_nicknames IS NULL;

