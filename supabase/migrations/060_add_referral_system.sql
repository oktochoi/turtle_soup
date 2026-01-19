-- 추천인 코드 시스템 마이그레이션

-- game_users 테이블에 referral_code 컬럼 추가 (고유, 7자리 영문+숫자)
ALTER TABLE game_users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 코인 컬럼 추가 (user_progress에)
ALTER TABLE user_progress ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0 NOT NULL;

-- 추천인 코드 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_game_users_referral_code ON game_users(referral_code) WHERE referral_code IS NOT NULL;

-- 추천인 코드 자동 생성 함수 (7자리 영문+숫자)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT := '';
  i INTEGER;
  char_index INTEGER;
BEGIN
  -- 7자리 코드 생성
  FOR i IN 1..7 LOOP
    char_index := 1 + floor(random() * length(chars))::INTEGER;
    code := code || substring(chars FROM char_index FOR 1);
  END LOOP;
  
  -- 중복 확인 (최대 100번 시도)
  DECLARE
    exists_check INTEGER;
    attempts INTEGER := 0;
  BEGIN
    LOOP
      SELECT COUNT(*) INTO exists_check
      FROM game_users
      WHERE referral_code = code;
      
      EXIT WHEN exists_check = 0 OR attempts >= 100;
      
      -- 코드 재생성
      code := '';
      FOR i IN 1..7 LOOP
        char_index := 1 + floor(random() * length(chars))::INTEGER;
        code := code || substring(chars FROM char_index FOR 1);
      END LOOP;
      
      attempts := attempts + 1;
    END LOOP;
  END;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 추천인 코드 자동 생성 트리거 함수
CREATE OR REPLACE FUNCTION set_referral_code_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- referral_code가 없으면 자동 생성
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (INSERT 시 자동으로 referral_code 생성)
DROP TRIGGER IF EXISTS trigger_set_referral_code ON game_users;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT ON game_users
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION set_referral_code_on_insert();

-- 코인 증가 RPC 함수
CREATE OR REPLACE FUNCTION increment_coins(user_id_param UUID, amount_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  -- user_progress에서 현재 코인 확인
  SELECT COALESCE(coins, 0) INTO current_coins
  FROM user_progress
  WHERE user_id = user_id_param;
  
  -- user_progress가 없으면 생성
  IF current_coins IS NULL THEN
    INSERT INTO user_progress (user_id, coins)
    VALUES (user_id_param, amount_param)
    ON CONFLICT (user_id) DO UPDATE SET coins = user_progress.coins + amount_param;
    RETURN amount_param;
  ELSE
    -- 코인 증가
    UPDATE user_progress
    SET coins = coins + amount_param
    WHERE user_id = user_id_param;
    RETURN current_coins + amount_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

