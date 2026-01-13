-- 커뮤니티 기능을 위한 마이그레이션 SQL
-- 게시글과 댓글 기능을 제공합니다.

-- Posts 테이블 (게시글)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'notice', 'daily', 'recommend', 'free', 'bug', 'hall_of_fame', 'funny', 'social'
  )),
  view_count INTEGER DEFAULT 0 NOT NULL,
  like_count INTEGER DEFAULT 0 NOT NULL,
  comment_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Post Comments 테이블 (댓글)
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Post Likes 테이블 (게시글 좋아요)
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- RLS 정책 설정
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 posts를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read posts" ON posts
  FOR SELECT USING (true);

-- 인증된 사용자만 posts를 생성할 수 있도록 설정
CREATE POLICY "Authenticated users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 작성자만 자신의 posts를 업데이트/삭제할 수 있도록 설정
CREATE POLICY "Authors can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- 모든 사용자가 post_comments를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read post_comments" ON post_comments
  FOR SELECT USING (true);

-- 인증된 사용자만 post_comments를 생성할 수 있도록 설정
CREATE POLICY "Authenticated users can create post_comments" ON post_comments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 작성자만 자신의 post_comments를 업데이트/삭제할 수 있도록 설정
CREATE POLICY "Authors can update their own post_comments" ON post_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own post_comments" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- 모든 사용자가 post_likes를 읽을 수 있도록 설정
CREATE POLICY "Anyone can read post_likes" ON post_likes
  FOR SELECT USING (true);

-- 인증된 사용자만 post_likes를 생성할 수 있도록 설정
CREATE POLICY "Authenticated users can create post_likes" ON post_likes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

-- 사용자만 자신의 post_likes를 삭제할 수 있도록 설정
CREATE POLICY "Users can delete their own post_likes" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 게시글 좋아요 수를 자동으로 업데이트하는 트리거 함수
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_post_like_count ON post_likes;
CREATE TRIGGER trigger_update_post_like_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_post_like_count();

-- 게시글 댓글 수를 자동으로 업데이트하는 트리거 함수
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_post_comment_count ON post_comments;
CREATE TRIGGER trigger_update_post_comment_count
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();

-- 게시글 조회수 업데이트 함수
CREATE OR REPLACE FUNCTION increment_post_view_count(post_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_uuid;
END;
$$ LANGUAGE plpgsql;

-- 기존 posts 테이블에 category 컬럼 추가 (이미 존재하는 경우를 대비)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'category'
  ) THEN
    ALTER TABLE posts 
      ADD COLUMN category TEXT NOT NULL DEFAULT 'free' 
      CHECK (category IN ('notice', 'daily', 'recommend', 'free', 'bug', 'hall_of_fame', 'funny', 'social'));
    
    -- 기본값 제거 (이제 NOT NULL 제약만 유지)
    ALTER TABLE posts 
      ALTER COLUMN category DROP DEFAULT;
  END IF;
END $$;

-- category 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);

