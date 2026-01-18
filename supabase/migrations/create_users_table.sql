-- users 테이블 생성 (public 스키마)
-- Supabase Auth (auth.users)와 연동하여 사용자 프로필 정보 저장

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 users를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read users" ON public.users
  FOR SELECT USING (true);

-- 인증된 사용자는 자신의 프로필을 생성할 수 있도록 설정
-- SECURITY DEFINER 함수도 통과할 수 있도록 true 허용
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR true);

-- 사용자는 자신의 정보만 업데이트할 수 있도록 설정
-- SECURITY DEFINER 함수도 통과할 수 있도록 허용
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- auth.users에 새 사용자가 생성될 때 public.users에 자동으로 프로필 생성하는 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_nickname TEXT;
BEGIN
  -- 닉네임 결정
  user_nickname := COALESCE(
    NEW.raw_user_meta_data->>'nickname',
    split_part(NEW.email, '@', 1),
    'User'
  );

  -- 먼저 email로 기존 사용자 확인
  IF EXISTS (SELECT 1 FROM public.users WHERE email = NEW.email AND id != NEW.id) THEN
    -- email이 이미 다른 id로 존재하면 업데이트
    UPDATE public.users
    SET id = NEW.id,
        nickname = COALESCE(user_nickname, public.users.nickname),
        updated_at = NOW()
    WHERE email = NEW.email;
  ELSE
    -- INSERT ... ON CONFLICT를 사용하여 id 충돌 처리
    INSERT INTO public.users (id, email, nickname)
    VALUES (NEW.id, NEW.email, user_nickname)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      nickname = COALESCE(EXCLUDED.nickname, public.users.nickname),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- UNIQUE 제약 조건 위반 시 재시도 (email 충돌)
    BEGIN
      UPDATE public.users
      SET id = NEW.id,
          nickname = COALESCE(
            COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1), 'User'),
            public.users.nickname
          ),
          updated_at = NOW()
      WHERE email = NEW.email;
      RETURN NEW;
    EXCEPTION
      WHEN others THEN
        RAISE WARNING 'Error updating user by email in handle_new_user: %', SQLERRM;
        RETURN NEW;
    END;
  WHEN others THEN
    -- 오류 발생 시 경고만 출력하고 계속 진행
    -- 트리거가 실패하면 auth.users 생성도 실패하므로 반드시 NEW를 반환해야 함
    RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (auth.users에 새 사용자가 생성될 때 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PostgREST가 테이블을 인식하도록 권한 부여
GRANT SELECT, INSERT, UPDATE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

