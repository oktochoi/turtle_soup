-- problem_likes 테이블의 user_identifier 컬럼을 TEXT에서 UUID로 변경

DO $$
BEGIN
  -- 테이블이 존재하는지 확인
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name = 'problem_likes') THEN
    
    -- 기존 UNIQUE 제약 조건 삭제 (필요한 경우)
    IF EXISTS (SELECT FROM pg_constraint 
               WHERE conname = 'problem_likes_problem_id_user_identifier_key') THEN
      ALTER TABLE problem_likes DROP CONSTRAINT problem_likes_problem_id_user_identifier_key;
    END IF;
    
    -- user_identifier 컬럼이 존재하는지 확인
    IF EXISTS (SELECT FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'problem_likes' 
               AND column_name = 'user_identifier') THEN
      
      -- TEXT 타입의 잘못된 데이터 정리 (UUID 형식이 아닌 데이터 삭제)
      DELETE FROM problem_likes 
      WHERE user_identifier !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
      
      -- 컬럼 타입 변경 (TEXT -> UUID)
      ALTER TABLE problem_likes 
      ALTER COLUMN user_identifier TYPE UUID USING user_identifier::UUID;
      
      RAISE NOTICE 'problem_likes.user_identifier 컬럼이 UUID 타입으로 변경되었습니다.';
    END IF;
    
    -- UNIQUE 제약 조건 다시 생성
    IF NOT EXISTS (SELECT FROM pg_constraint 
                   WHERE conname = 'problem_likes_problem_id_user_identifier_key') THEN
      ALTER TABLE problem_likes 
      ADD CONSTRAINT problem_likes_problem_id_user_identifier_key 
      UNIQUE (problem_id, user_identifier);
    END IF;
    
  END IF;
END $$;

