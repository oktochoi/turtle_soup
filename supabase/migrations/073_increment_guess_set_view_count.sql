-- guess_sets 조회수 증가: anon/authenticated에서 RPC로만 증가 (RLS 회피)
CREATE OR REPLACE FUNCTION increment_guess_set_view_count(set_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE guess_sets SET view_count = view_count + 1 WHERE id = set_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_guess_set_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_guess_set_view_count(UUID) TO authenticated;
