-- 사용자별 문제 정답 수를 저장하는 테이블
CREATE TABLE IF NOT EXISTS user_problem_solves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  problem_id UUID REFERENCES problems(id) ON DELETE CASCADE NOT NULL,
  solved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  similarity_score INTEGER NOT NULL, -- 정답률 (0-100)
  UNIQUE(user_id, problem_id) -- 같은 문제는 한 번만 카운트
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_problem_solves_user_id ON user_problem_solves(user_id);
CREATE INDEX IF NOT EXISTS idx_user_problem_solves_problem_id ON user_problem_solves(problem_id);

-- RLS 정책 설정
ALTER TABLE user_problem_solves ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 정답 기록을 읽을 수 있도록 설정
CREATE POLICY "Users can read their own solves" ON user_problem_solves
  FOR SELECT USING (auth.uid() = user_id);

-- 모든 사용자가 모든 정답 기록을 읽을 수 있도록 설정 (랭킹용)
CREATE POLICY "Anyone can read all solves" ON user_problem_solves
  FOR SELECT USING (true);

-- 인증된 사용자만 자신의 정답 기록을 생성할 수 있도록 설정
CREATE POLICY "Authenticated users can create their own solves" ON user_problem_solves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자별 총 정답 수를 조회하는 뷰 생성
CREATE OR REPLACE VIEW user_problem_solve_counts AS
SELECT 
  u.id as user_id,
  u.email,
  COUNT(ups.id) as solve_count
FROM auth.users u
LEFT JOIN user_problem_solves ups ON u.id = ups.user_id
GROUP BY u.id, u.email;

-- 뷰에 대한 권한 부여
GRANT SELECT ON user_problem_solve_counts TO anon, authenticated;

