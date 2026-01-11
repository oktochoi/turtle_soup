-- problem_difficulty_ratings 테이블에서 user_identifier 필드를 NULL 허용으로 변경
-- user_id로 전환하는 과정에서 하위 호환성을 위해 user_identifier를 NULL 허용으로 변경

DO $$ 
BEGIN
  -- user_identifier 필드가 존재하는 경우 NULL 허용으로 변경
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'problem_difficulty_ratings' 
             AND column_name = 'user_identifier') THEN
    ALTER TABLE problem_difficulty_ratings 
    ALTER COLUMN user_identifier DROP NOT NULL;
    ALTER TABLE problem_difficulty_ratings 
    ALTER COLUMN user_identifier SET DEFAULT NULL;
  END IF;
END $$;



​