-- user_id가 NULL인 경우를 특정 UUID로 업데이트하는 마이그레이션
-- 이 마이그레이션은 problem_likes 테이블의 user_id가 NULL인 레코드를 처리합니다.

-- problem_likes 테이블에서 user_id가 NULL인 경우 업데이트
UPDATE problem_likes
SET user_id = 'cf6342c8-4580-41d6-9e17-433df876173d'::UUID
WHERE user_id IS NULL;

-- 문제가 있는 경우를 확인하기 위한 쿼리 (실행 전 확인용)
-- SELECT COUNT(*) FROM problem_likes WHERE user_id IS NULL;

-- 업데이트 후 확인 쿼리
-- SELECT COUNT(*) FROM problem_likes WHERE user_id = 'cf6342c8-4580-41d6-9e17-433df876173d'::UUID;

