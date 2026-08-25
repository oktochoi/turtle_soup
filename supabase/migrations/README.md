# Supabase migrations (정리본)

이미 운영 DB에 적용된 옛 스크립트·일회성 시드/백필은 저장소에서 제거했습니다.  
**새 환경/미적용분만** 여기 있는 파일을 번호 순으로 SQL Editor에 실행하세요.

## 지금 쓰는 파일

| 파일 | 내용 |
|------|------|
| `040` ~ `061`, `063`~`065` | 퀴즈/채팅/레퍼럴/알림/explanation 등 |
| `067`~`071` | 라이어·학습 cron·답변·신고 |
| `072_problem_moderation.sql` | UGC `pending` 검수 |
| `074_threads_automation.sql` | Threads 토큰/포스트/인사이트 |
| `075`~`079` | 밸런스 게임 |
| `080_admin_post_comments_policy.sql` | 관리자 댓글 정책 (구 072 중복번호 정리) |
| `081_increment_guess_set_view_count.sql` | guess_set 조회수 |
| `082_system_chat_rooms_sudabang.sql` | 시스템 채팅방 |

## 최근에 꼭 확인할 것

운영에 Threads/AI 검수를 쓰려면:

1. `072_problem_moderation.sql`
2. `074_threads_automation.sql`
3. (아직이면) `065_add_problem_explanation.sql`

루트의 `supabase/schema.sql`은 참고용 스냅샷입니다. 마이그레이션 대용으로 쓰지 마세요.
