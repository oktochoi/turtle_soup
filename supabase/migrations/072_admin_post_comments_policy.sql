-- 어드민이 모든 댓글 수정/삭제 가능하도록 RLS 정책 추가
-- post_comments 테이블이 있는 경우에만 실행

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_comments'
  ) THEN
    -- 관리자는 모든 post_comments 수정 가능
    DROP POLICY IF EXISTS "Admins can update all post_comments" ON post_comments;
    CREATE POLICY "Admins can update all post_comments" ON post_comments
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
      );

    -- 관리자는 모든 post_comments 삭제 가능
    DROP POLICY IF EXISTS "Admins can delete all post_comments" ON post_comments;
    CREATE POLICY "Admins can delete all post_comments" ON post_comments
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
            AND users.is_admin = true
        )
      );
  END IF;
END $$;
