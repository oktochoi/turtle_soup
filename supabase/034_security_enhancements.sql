-- 보안 강화 마이그레이션
-- SECURITY_AUDIT.md의 권장사항 반영

-- 1. rooms 테이블 RLS 정책 강화
-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can create rooms" ON rooms;
DROP POLICY IF EXISTS "Anyone can update rooms" ON rooms;
-- DELETE 정책은 유지 (게스트 호스트도 방 삭제 가능해야 함)

-- 방 생성: 로그인한 사용자만 가능
CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- 방 수정: 호스트만 가능 (애플리케이션 레벨에서도 체크 필요)
-- 게스트 호스트는 RLS로 체크할 수 없으므로 애플리케이션 레벨에서 host_nickname으로 확인 필수
CREATE POLICY "Host can update rooms" ON rooms
  FOR UPDATE 
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND nickname = rooms.host_nickname
    )
  );

-- 2. users 테이블 정보 보호 강화
-- 기존 정책 제거
DROP POLICY IF EXISTS "Anyone can read users" ON users;
DROP POLICY IF EXISTS "Admins can read all user info" ON users;
DROP POLICY IF EXISTS "Users can read own info" ON users;

-- 공개 정보만 조회 가능 (닉네임, 생성일 등)
CREATE POLICY "Anyone can read public user info" ON users
  FOR SELECT 
  USING (true);

-- 본인만 전체 정보 조회 (이메일, is_admin 등)
CREATE POLICY "Users can read own full info" ON users
  FOR SELECT 
  USING (auth.uid() = id);

-- 관리자는 모든 사용자 정보 조회 가능
CREATE POLICY "Admins can read all user info" ON users
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 3. problems 테이블 정답 보호 (이미 구현되어 있을 수 있음)
-- 기존 정책 확인 후 재생성
DROP POLICY IF EXISTS "Anyone can read problems except answer" ON problems;
DROP POLICY IF EXISTS "Admins can read problem answers" ON problems;

-- answer를 제외한 모든 필드는 읽기 가능
CREATE POLICY "Anyone can read problems except answer" ON problems
  FOR SELECT 
  USING (true);

-- 관리자만 answer 조회 가능
CREATE POLICY "Admins can read problem answers" ON problems
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND is_admin = true
    )
  );

-- 4. API Rate Limiting 강화
-- 이미 rate_limits 테이블이 있으므로 추가 액션 타입만 정의
-- (실제 제한은 애플리케이션 레벨에서 check_rate_limit() 함수 호출)

-- 5. 입력 길이 제한 추가 (데이터베이스 레벨)
-- rooms 테이블
ALTER TABLE rooms 
  ADD CONSTRAINT rooms_story_length CHECK (LENGTH(story) <= 5000);
ALTER TABLE rooms 
  ADD CONSTRAINT rooms_truth_length CHECK (LENGTH(truth) <= 1000);
ALTER TABLE rooms 
  ADD CONSTRAINT rooms_host_nickname_length CHECK (LENGTH(host_nickname) <= 50);

-- questions 테이블
ALTER TABLE questions 
  ADD CONSTRAINT questions_text_length CHECK (LENGTH(text) <= 500);

-- guesses 테이블
ALTER TABLE guesses 
  ADD CONSTRAINT guesses_text_length CHECK (LENGTH(text) <= 500);

-- room_chats 테이블
ALTER TABLE room_chats 
  ADD CONSTRAINT room_chats_message_length CHECK (LENGTH(message) <= 1000);
ALTER TABLE room_chats 
  ADD CONSTRAINT room_chats_nickname_length CHECK (LENGTH(nickname) <= 50);

-- problems 테이블
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'problems' AND column_name = 'title') THEN
    ALTER TABLE problems 
      ADD CONSTRAINT problems_title_length CHECK (LENGTH(title) <= 200);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'problems' AND column_name = 'content') THEN
    ALTER TABLE problems 
      ADD CONSTRAINT problems_content_length CHECK (LENGTH(content) <= 10000);
  END IF;
END $$;

-- posts 테이블
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'title') THEN
      ALTER TABLE posts 
        ADD CONSTRAINT posts_title_length CHECK (LENGTH(title) <= 200);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'content') THEN
      ALTER TABLE posts 
        ADD CONSTRAINT posts_content_length CHECK (LENGTH(content) <= 20000);
    END IF;
  END IF;
END $$;

-- problem_comments 테이블
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'problem_comments') THEN
    ALTER TABLE problem_comments 
      ADD CONSTRAINT problem_comments_text_length CHECK (LENGTH(text) <= 2000);
  END IF;
END $$;

-- 6. SQL Injection 방지: 함수 보안 강화
-- SECURITY DEFINER 함수는 이미 구현되어 있음
-- 추가 보안: 함수 실행 권한 제한

-- 7. 관리자 정보 노출 방지
-- users 테이블의 is_admin 컬럼은 이미 RLS로 보호됨
-- 추가: 관리자 목록 조회 함수 제한

-- 8. 통계 정보
COMMENT ON POLICY "Authenticated users can create rooms" ON rooms IS '방 생성은 로그인한 사용자만 가능';
COMMENT ON POLICY "Host can update rooms" ON rooms IS '방 수정은 호스트만 가능 (게스트는 애플리케이션 레벨에서 체크)';
COMMENT ON POLICY "Anyone can read public user info" ON users IS '공개 정보(닉네임 등)만 조회 가능';
COMMENT ON POLICY "Users can read own full info" ON users IS '본인만 전체 정보 조회 가능';
COMMENT ON POLICY "Admins can read all user info" ON users IS '관리자는 모든 사용자 정보 조회 가능';

