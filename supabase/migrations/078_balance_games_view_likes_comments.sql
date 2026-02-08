-- balance_games: 조회수, 좋아요 수
ALTER TABLE balance_games ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE balance_games ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

-- 좋아요 테이블
CREATE TABLE IF NOT EXISTS balance_game_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES balance_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS balance_game_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES balance_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_balance_game_likes_game_id ON balance_game_likes(game_id);
CREATE INDEX IF NOT EXISTS idx_balance_game_likes_user_id ON balance_game_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_game_comments_game_id ON balance_game_comments(game_id);
CREATE INDEX IF NOT EXISTS idx_balance_games_view_count ON balance_games(view_count DESC);

-- 좋아요 수 트리거
CREATE OR REPLACE FUNCTION update_balance_game_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE balance_games SET like_count = like_count + 1 WHERE id = NEW.game_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE balance_games SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.game_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_balance_game_like_count ON balance_game_likes;
CREATE TRIGGER trigger_balance_game_like_count
  AFTER INSERT OR DELETE ON balance_game_likes
  FOR EACH ROW EXECUTE FUNCTION update_balance_game_like_count();

-- 조회수 증가 RPC
CREATE OR REPLACE FUNCTION increment_balance_game_view_count(game_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE balance_games SET view_count = view_count + 1 WHERE id = game_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_balance_game_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_balance_game_view_count(UUID) TO authenticated;

-- RLS
ALTER TABLE balance_game_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_game_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balance_game_likes_select" ON balance_game_likes;
CREATE POLICY "balance_game_likes_select" ON balance_game_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "balance_game_likes_insert" ON balance_game_likes;
CREATE POLICY "balance_game_likes_insert" ON balance_game_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "balance_game_likes_delete" ON balance_game_likes;
CREATE POLICY "balance_game_likes_delete" ON balance_game_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "balance_game_comments_select" ON balance_game_comments;
CREATE POLICY "balance_game_comments_select" ON balance_game_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "balance_game_comments_insert" ON balance_game_comments;
CREATE POLICY "balance_game_comments_insert" ON balance_game_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
