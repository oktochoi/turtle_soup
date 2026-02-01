-- 라이어 게임용 DB 스키마 확장
-- players, rooms 테이블에 라이어 게임 전용 컬럼 추가

-- 1. players 테이블에 라이어 게임용 컬럼 추가
ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS word TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_target TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS eliminated BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS votes_received INTEGER DEFAULT 0;

-- 2. rooms 테이블에 라이어 게임용 컬럼 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_name TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS speaking_time_minutes INTEGER DEFAULT 2;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_liars INTEGER DEFAULT 1;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 3. rooms.status에 라이어 게임 상태값 허용 (LOBBY, PLAYING, FINISHED)
-- 기존 status CHECK 제약 제거 (제약명은 DB마다 다를 수 있음)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'rooms' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ~ 'status'
  LOOP
    EXECUTE format('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_check 
  CHECK (status IN ('active', 'done', 'LOBBY', 'PLAYING', 'FINISHED'));
