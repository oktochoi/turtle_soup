-- 데이터베이스 쿼리 최적화를 위한 인덱스 추가
-- Pro 플랜에서 더 많은 인덱스를 활용하여 쿼리 성능 향상

-- 1. problems 테이블 최적화
-- 자주 조회되는 필드에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_problems_created_at ON problems(created_at DESC);

-- updated_at 컬럼이 있는 경우에만 인덱스 생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'problems' AND column_name = 'updated_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_problems_updated_at ON problems(updated_at DESC);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_problems_user_id ON problems(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_problems_like_count ON problems(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_problems_view_count ON problems(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_problems_lang ON problems(lang) WHERE lang IS NOT NULL;

-- 복합 인덱스: 정렬 및 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_problems_lang_created ON problems(lang, created_at DESC) WHERE lang IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_problems_lang_likes ON problems(lang, like_count DESC) WHERE lang IS NOT NULL;

-- 2. rooms 테이블 최적화
CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON rooms(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_host_nickname ON rooms(host_nickname);

-- 3. posts 테이블 최적화
CREATE INDEX IF NOT EXISTS idx_posts_category_created ON posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_is_notice_created ON posts(is_notice, created_at DESC) WHERE is_notice = true;
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_lang ON posts(lang) WHERE lang IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_view_count ON posts(view_count DESC);

-- 4. problem_comments 최적화
CREATE INDEX IF NOT EXISTS idx_problem_comments_problem_id_created ON problem_comments(problem_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_problem_comments_user_id ON problem_comments(user_id) WHERE user_id IS NOT NULL;

-- 5. game_users 최적화
CREATE INDEX IF NOT EXISTS idx_game_users_auth_user_id ON game_users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_users_created_at ON game_users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_users_nickname ON game_users(nickname);

-- 6. users 테이블 최적화
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 7. ai_bug_reports 최적화
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_status_created ON ai_bug_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_problem_id ON ai_bug_reports(problem_id) WHERE problem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_user_id ON ai_bug_reports(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_created_at ON ai_bug_reports(created_at DESC);

-- 8. events 테이블 최적화 (이벤트 추적)
CREATE INDEX IF NOT EXISTS idx_events_user_id_created ON events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_event_type_created ON events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- 9. room_chats 최적화 (실시간 채팅)
CREATE INDEX IF NOT EXISTS idx_room_chats_room_code_created ON room_chats(room_code, created_at DESC);

-- 10. questions 최적화
CREATE INDEX IF NOT EXISTS idx_questions_room_code_created ON questions(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_answer ON questions(answer) WHERE answer IS NOT NULL;

-- 11. guesses 최적화
CREATE INDEX IF NOT EXISTS idx_guesses_room_code_created ON guesses(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guesses_judged ON guesses(judged) WHERE judged = false;

-- 12. players 최적화
CREATE INDEX IF NOT EXISTS idx_players_room_code_joined ON players(room_code, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_is_host ON players(is_host) WHERE is_host = true;

-- 13. Full-text search 인덱스 (검색 성능 향상)
-- 한국어 텍스트 검색 설정이 있는 경우에만 생성
-- 'simple' 설정을 사용하거나 한국어 설정이 설치되어 있으면 'korean' 사용
DO $$
BEGIN
  -- 한국어 텍스트 검색 설정 확인
  IF EXISTS (
    SELECT 1 FROM pg_ts_config WHERE cfgname = 'korean'
  ) THEN
    -- 한국어 설정이 있으면 사용
    CREATE INDEX IF NOT EXISTS idx_problems_title_fts ON problems USING gin(to_tsvector('korean', COALESCE(title, '')));
    CREATE INDEX IF NOT EXISTS idx_problems_content_fts ON problems USING gin(to_tsvector('korean', COALESCE(content, '')));
    CREATE INDEX IF NOT EXISTS idx_posts_title_fts ON posts USING gin(to_tsvector('korean', COALESCE(title, '')));
    CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING gin(to_tsvector('korean', COALESCE(content, '')));
  ELSE
    -- 한국어 설정이 없으면 simple 설정 사용 (영어/기본 검색)
    CREATE INDEX IF NOT EXISTS idx_problems_title_fts ON problems USING gin(to_tsvector('simple', COALESCE(title, '')));
    CREATE INDEX IF NOT EXISTS idx_problems_content_fts ON problems USING gin(to_tsvector('simple', COALESCE(content, '')));
    CREATE INDEX IF NOT EXISTS idx_posts_title_fts ON posts USING gin(to_tsvector('simple', COALESCE(title, '')));
    CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING gin(to_tsvector('simple', COALESCE(content, '')));
  END IF;
END $$;

-- 14. 통계 쿼리 최적화를 위한 부분 인덱스
-- 활성 방만 조회하는 경우
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(created_at DESC) WHERE status = 'active';

-- 학습 가능한 버그 리포트만 조회
CREATE INDEX IF NOT EXISTS idx_ai_bug_reports_learning_ready ON ai_bug_reports(created_at DESC) 
  WHERE ignore_for_learning = false AND studied = false;

-- 공지사항만 조회
CREATE INDEX IF NOT EXISTS idx_posts_notices ON posts(created_at DESC) WHERE is_notice = true;

-- 15. 커버링 인덱스 (Covering Index) - 자주 사용되는 쿼리 최적화
-- 문제 목록 조회 시 필요한 필드만 포함
CREATE INDEX IF NOT EXISTS idx_problems_list_covering ON problems(id, title, content, like_count, view_count, created_at DESC, lang)
  WHERE lang IS NOT NULL;

-- 댓글 목록 조회 최적화
CREATE INDEX IF NOT EXISTS idx_problem_comments_list_covering ON problem_comments(id, problem_id, nickname, text, created_at DESC, is_spoiler);

-- 통계 정보
COMMENT ON INDEX idx_problems_created_at IS '문제 생성일 기준 정렬 최적화';
COMMENT ON INDEX idx_problems_lang_created IS '언어별 최신 문제 조회 최적화';
COMMENT ON INDEX idx_rooms_status_created IS '활성 방 목록 조회 최적화';
COMMENT ON INDEX idx_posts_is_notice_created IS '공지사항 우선 표시 최적화';
COMMENT ON INDEX idx_events_user_id_created IS '사용자별 이벤트 추적 최적화';
COMMENT ON INDEX idx_room_chats_room_code_created IS '방별 채팅 메시지 조회 최적화';

