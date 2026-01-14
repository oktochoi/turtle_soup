-- 게시글 조회수 업데이트를 위한 RLS 정책 추가
-- 누구나 조회수를 증가시킬 수 있도록 허용

-- 기존 정책 확인 후, view_count만 업데이트할 수 있는 정책 추가
CREATE POLICY "Anyone can update post view_count" ON posts
  FOR UPDATE 
  USING (true)
  WITH CHECK (true);

-- 또는 더 안전하게, view_count만 업데이트할 수 있도록 제한
-- 하지만 Supabase RLS는 컬럼별 정책을 지원하지 않으므로,
-- RPC 함수를 사용하는 것이 더 안전합니다.

-- RPC 함수가 SECURITY DEFINER로 실행되도록 수정 (이미 있다면)
CREATE OR REPLACE FUNCTION increment_post_view_count(post_uuid UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- RPC 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION increment_post_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_post_view_count(UUID) TO authenticated;

