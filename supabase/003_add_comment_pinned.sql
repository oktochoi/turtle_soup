-- 댓글 고정 기능을 위한 마이그레이션
-- post_comments 테이블에 is_pinned 컬럼 추가

-- is_pinned 컬럼 추가 (기본값 false)
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE NOT NULL;

-- 게시글 작성자가 자신의 게시글의 댓글을 고정/해제할 수 있도록 RLS 정책 추가
-- (기존 정책은 댓글 작성자만 수정 가능하므로, 게시글 작성자도 수정 가능하도록 추가)

-- 게시글 작성자가 자신의 게시글의 댓글을 업데이트할 수 있도록 정책 추가
CREATE POLICY IF NOT EXISTS "Post authors can update comments on their posts" ON post_comments
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_comments.post_id 
      AND posts.user_id = auth.uid()
    )
  );

-- 게시글 작성자가 자신의 게시글의 댓글을 삭제할 수 있도록 정책 추가
CREATE POLICY IF NOT EXISTS "Post authors can delete comments on their posts" ON post_comments
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM posts 
      WHERE posts.id = post_comments.post_id 
      AND posts.user_id = auth.uid()
    )
  );

-- 인덱스 추가 (고정 댓글 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_post_comments_is_pinned ON post_comments(is_pinned DESC, created_at ASC);

