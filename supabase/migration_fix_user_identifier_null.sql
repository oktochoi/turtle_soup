-- problem_likes 테이블의 user_identifier 컬럼을 NULL 허용으로 변경
-- user_id를 사용하므로 user_identifier는 더 이상 필수가 아님

-- user_identifier 컬럼이 NOT NULL인 경우 NULL 허용으로 변경
DO $$ 
BEGIN
  -- user_identifier 컬럼이 존재하고 NOT NULL인 경우에만 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'problem_likes' 
    AND column_name = 'user_identifier'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE problem_likes 
      ALTER COLUMN user_identifier DROP NOT NULL;
    
    ALTER TABLE problem_likes 
      ALTER COLUMN user_identifier SET DEFAULT NULL;
    
    RAISE NOTICE 'problem_likes.user_identifier 컬럼이 NULL 허용으로 변경되었습니다.';
  ELSE
    RAISE NOTICE 'problem_likes.user_identifier 컬럼이 이미 NULL 허용이거나 존재하지 않습니다.';
  END IF;
END $$;

