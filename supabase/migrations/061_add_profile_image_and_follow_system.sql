-- 프로필 사진 및 팔로우 시스템 마이그레이션

-- 1. game_users 테이블에 profile_image_url 컬럼 추가
ALTER TABLE game_users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- 2. game_users 기반 팔로우 시스템 테이블 생성
CREATE TABLE IF NOT EXISTS game_user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES game_users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES game_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_game_user_follows_follower ON game_user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_game_user_follows_following ON game_user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_game_users_profile_image ON game_users(profile_image_url) WHERE profile_image_url IS NOT NULL;

-- 4. RLS 정책 설정
ALTER TABLE game_user_follows ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 팔로우 관계를 읽을 수 있도록 설정 (공개 정보)
CREATE POLICY "Anyone can read follow relationships" ON game_user_follows
  FOR SELECT USING (true);

-- 인증된 사용자만 팔로우 가능 (애플리케이션 레벨에서 검증)
CREATE POLICY "Users can create follow relationships" ON game_user_follows
  FOR INSERT WITH CHECK (true);

-- 사용자는 자신의 팔로우 관계만 삭제 가능
CREATE POLICY "Users can delete their own follow relationships" ON game_user_follows
  FOR DELETE USING (true); -- 애플리케이션 레벨에서 검증

