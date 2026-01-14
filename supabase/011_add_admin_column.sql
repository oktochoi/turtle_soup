-- users 테이블에 is_admin 컬럼 추가
-- 관리자 권한을 데이터베이스에서 관리

-- is_admin 컬럼 추가 (기본값 false)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- 인덱스 생성 (관리자 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin) WHERE is_admin = TRUE;

-- 기존 사용자 중 특정 이메일을 관리자로 설정하는 함수
-- 사용법: SELECT set_admin_by_email('admin@example.com', true);
CREATE OR REPLACE FUNCTION set_admin_by_email(user_email TEXT, admin_status BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.users
  SET is_admin = admin_status
  WHERE email = user_email;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'User with email % not found', user_email;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION set_admin_by_email(TEXT, BOOLEAN) TO authenticated;

-- 관리자 확인 함수
CREATE OR REPLACE FUNCTION is_admin_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT is_admin INTO admin_status
  FROM public.users
  WHERE id = user_id;
  
  RETURN COALESCE(admin_status, FALSE);
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION is_admin_user(UUID) TO authenticated, anon;

-- 주석 추가
COMMENT ON COLUMN public.users.is_admin IS '관리자 여부 (true: 관리자, false: 일반 사용자)';
COMMENT ON FUNCTION set_admin_by_email(TEXT, BOOLEAN) IS '이메일로 사용자의 관리자 권한을 설정';
COMMENT ON FUNCTION is_admin_user(UUID) IS '사용자 ID로 관리자 여부 확인';

