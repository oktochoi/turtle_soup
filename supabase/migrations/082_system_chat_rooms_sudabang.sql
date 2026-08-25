-- 수다방 1, 2, 3을 항상 존재하는 시스템 기본 방으로 추가 (삭제 불가)

-- 1) chat_rooms에 is_system 컬럼 추가
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE NOT NULL;

-- 2) 시스템 수다방 시드 (코드 고정: SUDA01, SUDA02, SUDA03) - 없을 때만 삽입
INSERT INTO chat_rooms (code, name, host_nickname, max_members, is_public, is_system)
VALUES
  ('SUDA01', '수다방 1', '바다거북스프', 50, TRUE, TRUE),
  ('SUDA02', '수다방 2', '바다거북스프', 50, TRUE, TRUE),
  ('SUDA03', '수다방 3', '바다거북스프', 50, TRUE, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  host_nickname = EXCLUDED.host_nickname,
  max_members = EXCLUDED.max_members,
  is_public = EXCLUDED.is_public,
  is_system = TRUE;

-- 3) is_system 방은 삭제 불가: DELETE 정책 수정
DROP POLICY IF EXISTS "Anyone can delete chat_rooms" ON chat_rooms;
CREATE POLICY "Anyone can delete chat_rooms" ON chat_rooms
  FOR DELETE USING (COALESCE(is_system, FALSE) = FALSE);
