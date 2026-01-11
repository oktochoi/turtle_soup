-- problems 테이블에 user_id 추가 (public.users를 참조)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problems') THEN
    ALTER TABLE problems
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id);
  END IF;
END $$;

-- problem_comments 테이블에 user_id 추가 (public.users를 참조)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_comments') THEN
    ALTER TABLE problem_comments
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_problem_comments_user_id ON problem_comments(user_id);
  END IF;
END $$;

-- problem_difficulty_ratings 테이블에 user_id 추가 (public.users를 참조)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
     AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_difficulty_ratings') THEN
    ALTER TABLE problem_difficulty_ratings
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    
    CREATE INDEX IF NOT EXISTS idx_problem_difficulty_ratings_user_id ON problem_difficulty_ratings(user_id);
  END IF;
END $$;
