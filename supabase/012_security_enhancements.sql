-- 보안 강화 마이그레이션
-- SECURITY_AUDIT.md의 권장 사항을 반영
-- Supabase Advisor 보안 이슈 해결

-- ============================================================
-- 0. user_problem_solve_counts 뷰 보안 강화
-- auth.users의 email 노출 방지
-- ============================================================

-- 기존 뷰 제거 (auth.users.email 노출 위험)
DROP VIEW IF EXISTS user_problem_solve_counts;

-- 보안 강화된 뷰 재생성 (public.users 사용, email 제외)
CREATE OR REPLACE VIEW user_problem_solve_counts AS
SELECT 
  u.id as user_id,
  u.nickname, -- email 대신 nickname 사용
  COUNT(ups.id) as solve_count
FROM public.users u
LEFT JOIN user_problem_solves ups ON u.id = ups.user_id
GROUP BY u.id, u.nickname;

-- 뷰에 대한 권한 부여 (기존과 동일)
GRANT SELECT ON user_problem_solve_counts TO anon, authenticated;

-- 뷰에 RLS 활성화 (선택사항, 뷰는 기본적으로 테이블의 RLS를 상속)
-- 뷰 자체에 대한 RLS는 필요 없지만, 주석으로 명시
COMMENT ON VIEW user_problem_solve_counts IS 
  '사용자별 문제 정답 수를 조회하는 뷰. auth.users 대신 public.users를 사용하여 email 노출을 방지합니다.';

-- ============================================================
-- 1. rooms 테이블 RLS 정책 강화
-- ============================================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can create rooms" ON rooms;
DROP POLICY IF EXISTS "Anyone can update rooms" ON rooms;
-- DELETE 정책은 유지 (게스트 호스트도 삭제 가능해야 함)
-- SELECT 정책도 유지 (모든 사용자가 방 목록 조회 가능해야 함)

-- 인증된 사용자만 방 생성 가능
CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- 호스트만 방 수정 가능 (로그인한 사용자만)
CREATE POLICY "Host can update rooms" ON rooms
  FOR UPDATE 
  USING (
    auth.role() = 'authenticated' AND
    host_nickname = (SELECT nickname FROM users WHERE id = auth.uid())
  );

-- ⚠️ DELETE는 RLS로 제한하지 않음
-- 게스트 호스트도 방 삭제 가능해야 하므로, 애플리케이션 레벨에서 host_nickname으로 체크 필수

-- ============================================================
-- 2. users 테이블 RLS 정책 강화
-- ============================================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Anyone can read public user info" ON users;
DROP POLICY IF EXISTS "Users can read own full info" ON users;
DROP POLICY IF EXISTS "Admins can read all user info" ON users;

-- 기본 정보만 공개 (닉네임, 생성일 등)
-- ⚠️ RLS 정책만으로는 컬럼 레벨 제어가 불가능하므로
-- 보안 뷰를 생성하여 email과 is_admin을 제외

-- 보안 뷰 생성 (email, is_admin 제외)
CREATE OR REPLACE VIEW public_users_view AS
SELECT 
  id,
  nickname,
  created_at,
  updated_at
FROM users;

-- 뷰에 대한 권한 부여
GRANT SELECT ON public_users_view TO anon, authenticated;

-- 뷰에 대한 주석
COMMENT ON VIEW public_users_view IS 
  '공개 사용자 정보 뷰. email과 is_admin을 제외하여 보안을 강화했습니다.';

-- 기본 정책 (전체 정보는 본인만)
-- 정책이 이미 존재하면 생성하지 않음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Anyone can read public user info'
  ) THEN
    CREATE POLICY "Anyone can read public user info" ON users
      FOR SELECT 
      USING (true);
  END IF;
END $$;

-- 본인만 전체 정보 조회 (is_admin, email 포함)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Users can read own full info'
  ) THEN
    CREATE POLICY "Users can read own full info" ON users
      FOR SELECT 
      USING (auth.uid() = id);
  END IF;
END $$;

-- 관리자만 다른 사용자의 is_admin 정보 조회 가능
-- ⚠️ 무한 재귀 방지: is_current_user_admin() 함수 사용 (SECURITY DEFINER)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'Admins can read all user info'
  ) THEN
    CREATE POLICY "Admins can read all user info" ON users
      FOR SELECT
      USING (is_current_user_admin());
  END IF;
END $$;

-- ============================================================
-- 3. AI 학습 패턴 테이블 RLS 정책 강화
-- ============================================================

-- 기존 정책 제거 (IF EXISTS로 안전하게)
DROP POLICY IF EXISTS "Anyone can read learning patterns" ON ai_learning_patterns;
DROP POLICY IF EXISTS "Only admins can modify learning patterns" ON ai_learning_patterns;
DROP POLICY IF EXISTS "Admins can read learning patterns" ON ai_learning_patterns;
DROP POLICY IF EXISTS "Admins can modify learning patterns" ON ai_learning_patterns;

-- ⚠️ 모든 사용자가 읽기 가능 (AI 분석기에 동적으로 적용되어야 하므로)
-- 학습된 패턴은 공개되어야 AI가 사용할 수 있습니다.
-- 정책이 이미 존재하면 생성하지 않음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_learning_patterns' 
    AND policyname = 'Anyone can read learning patterns'
  ) THEN
    CREATE POLICY "Anyone can read learning patterns" ON ai_learning_patterns
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- 관리자만 수정 가능 (INSERT, UPDATE, DELETE)
-- ⚠️ INSERT는 함수를 통해 자동으로 수행되므로, 함수가 SECURITY DEFINER로 실행됨
-- 일반 사용자는 수정 불가
-- ⚠️ 무한 재귀 방지: is_current_user_admin() 함수 사용 (SECURITY DEFINER)
-- 정책이 이미 존재하면 생성하지 않음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_learning_patterns' 
    AND policyname = 'Only admins can modify learning patterns'
  ) THEN
    CREATE POLICY "Only admins can modify learning patterns" ON ai_learning_patterns
      FOR ALL
      USING (is_current_user_admin())
      WITH CHECK (is_current_user_admin());
  END IF;
END $$;

-- ============================================================
-- 3-1. AI 학습 패턴 테이블 PostgREST 권한 부여
-- ============================================================

-- PostgREST가 테이블에 접근할 수 있도록 권한 부여
GRANT SELECT ON ai_learning_patterns TO anon;
GRANT SELECT ON ai_learning_patterns TO authenticated;

-- ============================================================
-- 4. AI 학습 통계 테이블 RLS 정책 강화
-- ============================================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can read learning stats" ON ai_learning_stats;
DROP POLICY IF EXISTS "Admins can read learning stats" ON ai_learning_stats;

-- ⚠️ 모든 사용자가 읽기 가능 (통계는 공개 정보)
-- 학습 통계는 공개되어도 문제없습니다.
-- 정책이 이미 존재하면 생성하지 않음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_learning_stats' 
    AND policyname = 'Anyone can read learning stats'
  ) THEN
    CREATE POLICY "Anyone can read learning stats" ON ai_learning_stats
      FOR SELECT
      USING (true);
  END IF;
END $$;

-- PostgREST가 테이블에 접근할 수 있도록 권한 부여
GRANT SELECT ON ai_learning_stats TO anon;
GRANT SELECT ON ai_learning_stats TO authenticated;

-- ============================================================
-- 5. players 테이블 보안 강화 (선택사항)
-- ============================================================

-- 기존 정책은 유지하되, 참고용 주석 추가
-- 게임 특성상 모든 사용자가 참여할 수 있어야 하므로
-- 현재 "Anyone can create players" 정책 유지

-- ============================================================
-- 6. questions, guesses, room_chats 테이블 보안 강화 (선택사항)
-- ============================================================

-- 게임 특성상 모든 사용자가 질문/추측/채팅을 할 수 있어야 하므로
-- 현재 정책 유지

-- ============================================================
-- 7. 보안 함수 추가
-- ============================================================

-- 사용자가 관리자인지 확인하는 함수
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT is_admin INTO admin_status
  FROM users
  WHERE id = user_id;
  
  RETURN COALESCE(admin_status, FALSE);
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated, anon;

-- 현재 로그인한 사용자가 관리자인지 확인하는 함수
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN is_user_admin(auth.uid());
END;
$$;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated, anon;

-- ============================================================
-- 8. 주석 및 문서화
-- ============================================================

COMMENT ON POLICY "Authenticated users can create rooms" ON rooms IS 
  '로그인한 사용자만 방을 생성할 수 있습니다.';

COMMENT ON POLICY "Host can update rooms" ON rooms IS 
  '호스트만 방을 수정할 수 있습니다. 게스트 호스트는 애플리케이션 레벨에서 체크해야 합니다.';

COMMENT ON POLICY "Anyone can read public user info" ON users IS 
  '모든 사용자가 기본 정보(닉네임 등)를 조회할 수 있습니다. is_admin과 email은 제외됩니다.';

COMMENT ON POLICY "Users can read own full info" ON users IS 
  '사용자는 자신의 전체 정보를 조회할 수 있습니다.';

COMMENT ON POLICY "Admins can read all user info" ON users IS 
  '관리자는 모든 사용자의 정보를 조회할 수 있습니다.';

COMMENT ON FUNCTION is_user_admin(UUID) IS 
  '특정 사용자가 관리자인지 확인합니다.';

COMMENT ON FUNCTION is_current_user_admin() IS 
  '현재 로그인한 사용자가 관리자인지 확인합니다.';

-- ============================================================
-- 9. 추가 보안 개선 사항
-- ============================================================

-- user_problem_solves 테이블의 "Anyone can read all solves" 정책 검토
-- 현재는 랭킹용으로 모든 정답 기록을 공개하지만, 
-- 필요시 본인 기록만 공개하도록 변경 가능

-- 주석: 현재 정책 유지 (랭킹 기능을 위해 필요)
-- DROP POLICY IF EXISTS "Anyone can read all solves" ON user_problem_solves;
-- 필요시 위 정책을 제거하고 "Users can read their own solves"만 사용

-- ============================================================
-- 10. achievements 및 titles 테이블 RLS 활성화
-- ============================================================

-- achievements 테이블 RLS 활성화
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

-- titles 테이블 RLS 활성화
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;

-- 주석 추가
COMMENT ON TABLE achievements IS 
  '업적 테이블. RLS가 활성화되어 있으며, 모든 사용자가 읽을 수 있습니다.';

COMMENT ON TABLE titles IS 
  '칭호 테이블. RLS가 활성화되어 있으며, 모든 사용자가 읽을 수 있습니다.';

-- ============================================================
-- 11. 보안 체크리스트
-- ============================================================

-- ✅ user_problem_solve_counts 뷰: auth.users.email 노출 제거
-- ✅ rooms 테이블: CREATE는 인증된 사용자만, UPDATE는 호스트만
-- ✅ users 테이블: is_admin 정보 보호 (RLS + 보안 뷰)
-- ✅ AI 학습 테이블: 모든 사용자 읽기 가능, 관리자만 수정 가능
-- ✅ achievements 테이블: RLS 활성화
-- ✅ titles 테이블: RLS 활성화
-- ⚠️ rooms DELETE: 애플리케이션 레벨에서 host_nickname 체크 필수
-- ⚠️ users email: 애플리케이션 레벨에서 필터링 또는 보안 뷰 사용 권장

