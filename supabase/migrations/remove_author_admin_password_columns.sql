-- problems 테이블에서 author와 admin_password 컬럼 완전히 제거

DO $$ 
BEGIN
  -- admin_password 컬럼 제거
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'problems' 
             AND column_name = 'admin_password') THEN
    ALTER TABLE problems DROP COLUMN admin_password;
    RAISE NOTICE 'admin_password 컬럼이 제거되었습니다.';
  END IF;
  
  -- author 컬럼 제거
  IF EXISTS (SELECT FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'problems' 
             AND column_name = 'author') THEN
    ALTER TABLE problems DROP COLUMN author;
    RAISE NOTICE 'author 컬럼이 제거되었습니다.';
  END IF;
END $$;

