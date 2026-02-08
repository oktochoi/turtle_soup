-- 밸런스 게임 (토너먼트형): 둘 중 하나 선택 → 결승까지 한 선택만 살아남음. 정답/해설 없음.

-- 1. 밸런스 게임 정의
CREATE TABLE IF NOT EXISTS balance_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  tournament_size INT NOT NULL CHECK (tournament_size IN (8, 16, 32, 64, 128)),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. 선택지 (게임당 최소 8 ~ 최대 128)
CREATE TABLE IF NOT EXISTS balance_game_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES balance_games(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_balance_game_options_game ON balance_game_options(game_id);

-- 3. 플레이 세션 (한 유저/세션이 한 게임을 플레이하는 단위)
CREATE TABLE IF NOT EXISTS balance_game_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES balance_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  shuffled_option_ids UUID[] NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT balance_play_identity CHECK (user_id IS NOT NULL OR (session_id IS NOT NULL AND session_id <> ''))
);

CREATE INDEX IF NOT EXISTS idx_balance_game_plays_game ON balance_game_plays(game_id);
CREATE INDEX IF NOT EXISTS idx_balance_game_plays_user ON balance_game_plays(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_game_plays_session ON balance_game_plays(session_id);

-- 4. 라운드별 선택 (복원 가능)
CREATE TABLE IF NOT EXISTS balance_game_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id UUID NOT NULL REFERENCES balance_game_plays(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  match_index INT NOT NULL,
  chosen_option_id UUID NOT NULL REFERENCES balance_game_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(play_id, round_number, match_index)
);

CREATE INDEX IF NOT EXISTS idx_balance_game_choices_play ON balance_game_choices(play_id);

-- RLS
ALTER TABLE balance_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_game_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_game_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_game_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read balance_games" ON balance_games FOR SELECT USING (true);
CREATE POLICY "Authenticated can create balance_games" ON balance_games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read balance_game_options" ON balance_game_options FOR SELECT USING (true);
CREATE POLICY "Authenticated can create balance_game_options" ON balance_game_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read balance_game_plays" ON balance_game_plays FOR SELECT USING (true);
CREATE POLICY "Anyone can insert balance_game_plays" ON balance_game_plays FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own balance_game_plays" ON balance_game_plays FOR UPDATE USING (true);
CREATE POLICY "Anyone can read balance_game_choices" ON balance_game_choices FOR SELECT USING (true);
CREATE POLICY "Anyone can insert balance_game_choices" ON balance_game_choices FOR INSERT WITH CHECK (true);
