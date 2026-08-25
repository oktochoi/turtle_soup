-- Threads automation: posts, insights, encrypted tokens, generation logs
-- Reuses existing problems table; does NOT alter puzzle content schema.

CREATE TABLE IF NOT EXISTS public.threads_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threads_user_id TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.threads_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
  threads_media_id TEXT NOT NULL UNIQUE,
  threads_user_id TEXT,
  post_text TEXT,
  permalink TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threads_posts_published_at_idx
  ON public.threads_posts (published_at DESC);

CREATE INDEX IF NOT EXISTS threads_posts_problem_id_idx
  ON public.threads_posts (problem_id);

CREATE TABLE IF NOT EXISTS public.threads_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threads_post_id UUID NOT NULL REFERENCES public.threads_posts(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_since_publish INTEGER NOT NULL,
  views INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  quotes INTEGER,
  shares INTEGER,
  raw JSONB DEFAULT '{}'::jsonb,
  UNIQUE (threads_post_id, hours_since_publish)
);

CREATE INDEX IF NOT EXISTS threads_insights_post_id_idx
  ON public.threads_insights (threads_post_id);

CREATE TABLE IF NOT EXISTS public.puzzle_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
  judge_score NUMERIC,
  detail JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service role / backend only; lock down via RLS deny-all for anon
ALTER TABLE public.threads_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_generation_logs ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies → only service_role can access by default (bypasses RLS)
