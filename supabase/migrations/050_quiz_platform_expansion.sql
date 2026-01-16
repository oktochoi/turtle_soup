-- 퀴즈 플랫폼 확장 마이그레이션
-- 다양한 퀴즈 타입을 지원하는 구조로 확장

-- 1. 퀴즈 타입 enum 생성
CREATE TYPE quiz_type AS ENUM (
  'soup',           -- 바다거북스프
  'reasoning',      -- 상황 추리
  'nonsense',       -- 넌센스 퀴즈
  'mcq',            -- 객관식 (4지선다)
  'ox',             -- OX 퀴즈
  'image',          -- 이미지 기반
  'poll',           -- 투표
  'balance',        -- 밸런스 게임
  'logic',          -- 논리 퍼즐
  'pattern',        -- 수열/패턴
  'fill_blank',     -- 빈칸 퀴즈 (단답형)
  'order',          -- 순서 맞추기 퀴즈
  'liar',           -- 라이어 게임 (멀티플레이)
  'mafia',          -- 마피아 (멀티플레이)
  'battle'          -- 퀴즈 배틀
);

-- 2. quizzes 테이블 확장 (기존 테이블 수정)
ALTER TABLE problems ADD COLUMN IF NOT EXISTS type quiz_type DEFAULT 'soup';
ALTER TABLE problems ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'featured', 'archived'));
ALTER TABLE problems ADD COLUMN IF NOT EXISTS difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5);
ALTER TABLE problems ADD COLUMN IF NOT EXISTS play_count INTEGER DEFAULT 0;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE problems ADD COLUMN IF NOT EXISTS estimated_time INTEGER; -- 예상 플레이 시간 (초)
ALTER TABLE problems ADD COLUMN IF NOT EXISTS is_multiplayer BOOLEAN DEFAULT false;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS min_players INTEGER DEFAULT 1;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 1;

-- 기존 problems의 type을 'soup'으로 설정
UPDATE problems SET type = 'soup' WHERE type IS NULL;

-- 3. quiz_contents 테이블 생성 (타입별 세부 데이터)
CREATE TABLE IF NOT EXISTS quiz_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  
  -- 타입별 구조화된 데이터 (JSONB)
  -- soup: {"story": "...", "answer": "...", "hints": [...]}
  -- mcq/ox: {"question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..."}
  -- image: {"image_url": "...", "question": "...", "answer": "..."}
  -- poll: {"question": "...", "options": ["A", "B"], "show_stats": true}
  content JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(quiz_id)
);

-- 4. quiz_votes 테이블 (좋아요/싫어요)
CREATE TABLE IF NOT EXISTS quiz_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(quiz_id, user_id)
);

-- 5. quiz_bookmarks 테이블
CREATE TABLE IF NOT EXISTS quiz_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(quiz_id, user_id)
);

-- 6. quiz_plays 테이블 (플레이 기록)
CREATE TABLE IF NOT EXISTS quiz_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES problems(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL, -- 멀티플레이 시
  result TEXT CHECK (result IN ('correct', 'incorrect', 'abandoned')),
  score INTEGER DEFAULT 0,
  time_spent INTEGER DEFAULT 0, -- 초 단위
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. quiz_follow_creators 테이블 (크리에이터 팔로우)
CREATE TABLE IF NOT EXISTS quiz_follow_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(follower_id, creator_id),
  CHECK (follower_id != creator_id)
);

-- 8. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_problems_type ON problems(type);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_contents_quiz ON quiz_contents(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_votes_quiz ON quiz_votes(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_votes_user ON quiz_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_bookmarks_quiz ON quiz_bookmarks(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_bookmarks_user ON quiz_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_plays_quiz ON quiz_plays(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_plays_user ON quiz_plays(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_follow_creator ON quiz_follow_creators(creator_id);

-- 9. 좋아요/북마크 카운트 업데이트 함수
CREATE OR REPLACE FUNCTION update_quiz_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problems 
    SET like_count = (
      SELECT COUNT(*) FROM quiz_votes 
      WHERE quiz_id = NEW.quiz_id AND vote_type = 'like'
    )
    WHERE id = NEW.quiz_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problems 
    SET like_count = (
      SELECT COUNT(*) FROM quiz_votes 
      WHERE quiz_id = OLD.quiz_id AND vote_type = 'like'
    )
    WHERE id = OLD.quiz_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_quiz_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE problems 
    SET bookmark_count = (
      SELECT COUNT(*) FROM quiz_bookmarks 
      WHERE quiz_id = NEW.quiz_id
    )
    WHERE id = NEW.quiz_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE problems 
    SET bookmark_count = (
      SELECT COUNT(*) FROM quiz_bookmarks 
      WHERE quiz_id = OLD.quiz_id
    )
    WHERE id = OLD.quiz_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_quiz_play_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE problems 
  SET play_count = (
    SELECT COUNT(*) FROM quiz_plays 
    WHERE quiz_id = NEW.quiz_id
  )
  WHERE id = NEW.quiz_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_quiz_like_count ON quiz_votes;
CREATE TRIGGER trigger_update_quiz_like_count
  AFTER INSERT OR DELETE ON quiz_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_like_count();

DROP TRIGGER IF EXISTS trigger_update_quiz_bookmark_count ON quiz_bookmarks;
CREATE TRIGGER trigger_update_quiz_bookmark_count
  AFTER INSERT OR DELETE ON quiz_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_bookmark_count();

DROP TRIGGER IF EXISTS trigger_update_quiz_play_count ON quiz_plays;
CREATE TRIGGER trigger_update_quiz_play_count
  AFTER INSERT ON quiz_plays
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_play_count();

-- 10. RLS 정책 적용
ALTER TABLE quiz_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_follow_creators ENABLE ROW LEVEL SECURITY;

-- quiz_contents: published 퀴즈는 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view published quiz contents"
  ON quiz_contents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = quiz_contents.quiz_id
      AND problems.status IN ('published', 'featured')
    )
  );

-- quiz_contents: 퀴즈 소유자만 수정 가능
CREATE POLICY "Only quiz creator can modify contents"
  ON quiz_contents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = quiz_contents.quiz_id
      AND problems.user_id = auth.uid()
    )
  );

-- quiz_votes: 모든 사용자가 좋아요 가능 (published 퀴즈만)
CREATE POLICY "Anyone can vote on published quizzes"
  ON quiz_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = quiz_votes.quiz_id
      AND problems.status IN ('published', 'featured')
    )
    AND auth.uid() IS NOT NULL
  );

-- quiz_votes: 본인 것만 조회/삭제 가능
CREATE POLICY "Users can view/delete their own votes"
  ON quiz_votes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own votes"
  ON quiz_votes FOR DELETE
  USING (user_id = auth.uid());

-- quiz_bookmarks: 모든 사용자가 북마크 가능
CREATE POLICY "Anyone can bookmark published quizzes"
  ON quiz_bookmarks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM problems
      WHERE problems.id = quiz_bookmarks.quiz_id
      AND problems.status IN ('published', 'featured')
    )
    AND auth.uid() IS NOT NULL
  );

-- quiz_bookmarks: 본인 것만 조회/삭제 가능
CREATE POLICY "Users can view/delete their own bookmarks"
  ON quiz_bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own bookmarks"
  ON quiz_bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- quiz_plays: 본인 플레이 기록만 조회 가능
CREATE POLICY "Users can view their own plays"
  ON quiz_plays FOR SELECT
  USING (user_id = auth.uid());

-- quiz_plays: 인증된 사용자만 생성 가능
CREATE POLICY "Authenticated users can create play records"
  ON quiz_plays FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- quiz_follow_creators: 본인 팔로우 관계만 조회 가능
CREATE POLICY "Users can view their own follows"
  ON quiz_follow_creators FOR SELECT
  USING (follower_id = auth.uid());

-- quiz_follow_creators: 인증된 사용자만 팔로우 가능
CREATE POLICY "Authenticated users can follow creators"
  ON quiz_follow_creators FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND follower_id = auth.uid());

CREATE POLICY "Users can unfollow creators"
  ON quiz_follow_creators FOR DELETE
  USING (follower_id = auth.uid());

