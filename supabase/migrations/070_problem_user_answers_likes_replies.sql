-- 사용자 답변 공개, 좋아요, 대댓글 기능
-- 1. problem_user_answers: 사용자가 제출한 정답 추측 (다른 사람들이 볼 수 있음)
-- 2. problem_answer_likes: 답변에 대한 좋아요
-- 3. problem_answer_replies: 답변에 대한 대댓글
-- 4. problem_comments: parent_id 추가 (댓글에 대한 대댓글)

-- 1. 사용자 답변 테이블
CREATE TABLE IF NOT EXISTS problem_user_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  similarity_score INTEGER, -- 0-100 (유사도 점수)
  like_count INTEGER DEFAULT 0 NOT NULL,
  reply_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT problem_user_answers_answer_text_length CHECK (LENGTH(answer_text) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_problem_user_answers_problem_id ON problem_user_answers(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_user_answers_user_id ON problem_user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_problem_user_answers_created_at ON problem_user_answers(problem_id, created_at DESC);

-- 2. 답변 좋아요 테이블
CREATE TABLE IF NOT EXISTS problem_answer_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES problem_user_answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(answer_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_problem_answer_likes_answer_id ON problem_answer_likes(answer_id);
CREATE INDEX IF NOT EXISTS idx_problem_answer_likes_user_id ON problem_answer_likes(user_id);

-- 3. 답변 대댓글 테이블
CREATE TABLE IF NOT EXISTS problem_answer_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES problem_user_answers(id) ON DELETE CASCADE,
  parent_reply_id UUID REFERENCES problem_answer_replies(id) ON DELETE CASCADE, -- 대대댓글용 (nullable)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT problem_answer_replies_text_length CHECK (LENGTH(text) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_problem_answer_replies_answer_id ON problem_answer_replies(answer_id);
CREATE INDEX IF NOT EXISTS idx_problem_answer_replies_parent ON problem_answer_replies(parent_reply_id);

-- 4. problem_comments에 parent_id 추가 (댓글 대댓글)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_comments') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'problem_comments' AND column_name = 'parent_id') THEN
      ALTER TABLE problem_comments
        ADD COLUMN parent_id UUID REFERENCES problem_comments(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_problem_comments_parent_id ON problem_comments(parent_id);
    END IF;
  END IF;
END $$;

-- RLS
ALTER TABLE problem_user_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_answer_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_answer_replies ENABLE ROW LEVEL SECURITY;

-- problem_user_answers: 모두 읽기, 로그인 사용자만 작성
CREATE POLICY "Anyone can read problem_user_answers" ON problem_user_answers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create problem_user_answers" ON problem_user_answers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own problem_user_answers" ON problem_user_answers
  FOR DELETE USING (auth.uid() = user_id);

-- problem_answer_likes
CREATE POLICY "Anyone can read problem_answer_likes" ON problem_answer_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create problem_answer_likes" ON problem_answer_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own problem_answer_likes" ON problem_answer_likes
  FOR DELETE USING (auth.uid() = user_id);

-- problem_answer_replies
CREATE POLICY "Anyone can read problem_answer_replies" ON problem_answer_replies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create problem_answer_replies" ON problem_answer_replies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own problem_answer_replies" ON problem_answer_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own problem_answer_replies" ON problem_answer_replies
  FOR DELETE USING (auth.uid() = user_id);

-- 답변 좋아요 트리거 (like_count 업데이트)
CREATE OR REPLACE FUNCTION update_problem_answer_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problem_user_answers SET like_count = like_count + 1 WHERE id = NEW.answer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problem_user_answers SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.answer_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_problem_answer_like_count ON problem_answer_likes;
CREATE TRIGGER trigger_problem_answer_like_count
  AFTER INSERT OR DELETE ON problem_answer_likes
  FOR EACH ROW EXECUTE FUNCTION update_problem_answer_like_count();

-- 답변 대댓글 트리거 (reply_count 업데이트)
CREATE OR REPLACE FUNCTION update_problem_answer_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problem_user_answers SET reply_count = reply_count + 1 WHERE id = NEW.answer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problem_user_answers SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.answer_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_problem_answer_reply_count ON problem_answer_replies;
CREATE TRIGGER trigger_problem_answer_reply_count
  AFTER INSERT OR DELETE ON problem_answer_replies
  FOR EACH ROW EXECUTE FUNCTION update_problem_answer_reply_count();
