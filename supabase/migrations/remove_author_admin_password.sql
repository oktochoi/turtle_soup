-- problems 테이블에서 author와 admin_password 필드를 제거하고 user_id로 대체

-- author와 admin_password 필드를 NULL 허용으로 변경 (하위 호환성)
DO $$ 
BEGIN
  -- author 필드가 존재하는 경우 NULL 허용으로 변경
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'problems' AND column_name = 'author') THEN
    ALTER TABLE problems ALTER COLUMN author DROP NOT NULL;
    ALTER TABLE problems ALTER COLUMN author SET DEFAULT NULL;
  END IF;
  
  -- admin_password 필드가 존재하는 경우 NULL 허용으로 변경
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'problems' AND column_name = 'admin_password') THEN
    ALTER TABLE problems ALTER COLUMN admin_password DROP NOT NULL;
    ALTER TABLE problems ALTER COLUMN admin_password SET DEFAULT NULL;
  END IF;
END $$;

