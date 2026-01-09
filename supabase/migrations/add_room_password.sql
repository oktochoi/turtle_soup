-- 방 비밀번호 필드 추가
-- rooms 테이블에 password 컬럼 추가 (NULL이면 공개방)

ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS password TEXT NULL;

-- 주석 추가
COMMENT ON COLUMN rooms.password IS '방 비밀번호 (NULL이면 공개방, 값이 있으면 비밀번호가 필요한 방)';

