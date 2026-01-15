-- 공지사항 기능 추가
-- 공지사항은 관리자만 작성 가능하고, 전체 카테고리에서 항상 최상단에 표시됩니다.

-- 1. posts 테이블에 is_notice 컬럼 추가 (공지사항 여부)
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS is_notice BOOLEAN DEFAULT false NOT NULL;

-- 2. 인덱스 추가 (공지사항 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_posts_is_notice ON posts(is_notice) WHERE is_notice = true;

-- 3. RLS 정책 수정: 공지사항 작성은 관리자만 가능
DO $$
BEGIN
  -- 기존 정책 삭제
  DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
  DROP POLICY IF EXISTS "Admins can create notice posts" ON posts;
  
  -- 일반 게시글은 인증된 사용자 모두 작성 가능
  CREATE POLICY "Authenticated users can create posts" ON posts
    FOR INSERT WITH CHECK (
      auth.role() = 'authenticated'
      AND (
        is_notice = false
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
      )
    );
  
  -- 관리자는 공지사항 작성 가능
  CREATE POLICY "Admins can create notice posts" ON posts
    FOR INSERT WITH CHECK (
      is_notice = true
      AND EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.is_admin = true
      )
    );
END $$;

-- 4. 관리자는 모든 게시글 수정/삭제 가능
DO $$
BEGIN
  -- 기존 정책 삭제
  DROP POLICY IF EXISTS "Admins can update all posts" ON posts;
  DROP POLICY IF EXISTS "Admins can delete all posts" ON posts;
  
  -- 관리자 업데이트 정책 생성
  CREATE POLICY "Admins can update all posts" ON posts
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.is_admin = true
      )
    );
  
  -- 관리자 삭제 정책 생성
  CREATE POLICY "Admins can delete all posts" ON posts
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
          AND users.is_admin = true
      )
    );
END $$;

-- 5. 주석 추가
COMMENT ON COLUMN posts.is_notice IS 
'공지사항 여부. true이면 관리자만 작성 가능하고, 전체 카테고리에서 항상 최상단에 표시됩니다.';

