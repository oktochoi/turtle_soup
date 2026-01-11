-- problem_comments와 problem_difficulty_ratings에 로그인 필요 RLS 정책 추가

-- 기존 정책 삭제 후 새 정책 생성
DO $$ 
BEGIN
  -- problem_comments 기존 정책 삭제
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Anyone can create problem_comments') THEN
    DROP POLICY "Anyone can create problem_comments" ON problem_comments;
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Anyone can update problem_comments') THEN
    DROP POLICY "Anyone can update problem_comments" ON problem_comments;
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Anyone can delete problem_comments') THEN
    DROP POLICY "Anyone can delete problem_comments" ON problem_comments;
  END IF;
  
  -- problem_difficulty_ratings 기존 정책 삭제
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_difficulty_ratings' AND policyname = 'Anyone can create problem_difficulty_ratings') THEN
    DROP POLICY "Anyone can create problem_difficulty_ratings" ON problem_difficulty_ratings;
  END IF;
  
  IF EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_difficulty_ratings' AND policyname = 'Anyone can update problem_difficulty_ratings') THEN
    DROP POLICY "Anyone can update problem_difficulty_ratings" ON problem_difficulty_ratings;
  END IF;
END $$;

-- problem_comments: 로그인한 사용자만 생성/수정/삭제 가능
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_comments') THEN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Authenticated users can create problem_comments') THEN
      CREATE POLICY "Authenticated users can create problem_comments" ON problem_comments
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Users can update own comments') THEN
      CREATE POLICY "Users can update own comments" ON problem_comments
        FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_comments' AND policyname = 'Users can delete own comments') THEN
      CREATE POLICY "Users can delete own comments" ON problem_comments
        FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
    END IF;
  END IF;
END $$;

-- problem_difficulty_ratings: 로그인한 사용자만 생성/수정 가능
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_difficulty_ratings') THEN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_difficulty_ratings' AND policyname = 'Authenticated users can create problem_difficulty_ratings') THEN
      CREATE POLICY "Authenticated users can create problem_difficulty_ratings" ON problem_difficulty_ratings
        FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE schemaname = 'public' AND tablename = 'problem_difficulty_ratings' AND policyname = 'Users can update own ratings') THEN
      CREATE POLICY "Users can update own ratings" ON problem_difficulty_ratings
        FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
    END IF;
  END IF;
END $$;

