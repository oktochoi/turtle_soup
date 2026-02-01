# 라이어 게임 오류 수정 가이드

라이어 게임(`liar_room/[id]/page.tsx`) 코드 분석 결과 발견된 문제점과 수정 방법입니다.

> **✅ 2025-02-01 적용 완료**: 아래 수정 사항이 코드에 반영되었습니다.

---

## 1. 🔴 긴급: DB 스키마 누락

### 문제
- **players 테이블**: `role`, `word`, `vote_target`, `eliminated`, `votes_received` 컬럼이 없음
- **rooms 테이블**: `room_name`, `theme`, `level`, `host_user_id`, `speaking_time_minutes` 등 라이어 게임용 컬럼이 마이그레이션에 없을 수 있음

### 해결
새 마이그레이션 파일 생성 (`supabase/migrations/067_liar_game_schema.sql`):

```sql
-- players 테이블에 라이어 게임용 컬럼 추가
ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS word TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_target TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS eliminated BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS votes_received INTEGER DEFAULT 0;

-- rooms 테이블에 라이어 게임용 컬럼 추가
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_name TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES auth.users(id);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS speaking_time_minutes INTEGER DEFAULT 2;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_liars INTEGER DEFAULT 1;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- rooms.status에 'LOBBY', 'PLAYING', 'FINISHED' 값 허용 (기존 CHECK 수정 필요할 수 있음)
-- 기존: CHECK (status IN ('active', 'done'))
-- 라이어: status IN ('LOBBY', 'PLAYING', 'FINISHED')
```

---

## 2. 🔴 긴급: 닉네임/관리자 조회 오류

### 문제 (liar_room/page.tsx 59-81행)
- `game_users.eq('id', user.id)` → **잘못됨**. `user.id`는 `auth.users.id`인데, `game_users.id`는 별도 UUID
- 닉네임을 `users` 테이블에서만 조회 → 앱 대부분은 `game_users` 사용

### 수정
```typescript
// 기존 (잘못됨)
const { data: gameUser } = await supabase
  .from('game_users')
  .select('is_admin')
  .eq('id', user.id)  // ❌ user.id는 auth id

const { data: userData } = await supabaseClient
  .from('users')
  .select('nickname')
  .eq('id', user.id);

// 수정 (다른 페이지와 동일하게)
const { data: gameUser } = await supabase
  .from('game_users')
  .select('is_admin')
  .eq('auth_user_id', user.id);  // ✅ auth_user_id 사용

// 닉네임: game_users 우선, 없으면 users
const { data: gameUserData } = await supabaseClient
  .from('game_users')
  .select('nickname')
  .eq('auth_user_id', user.id)
  .maybeSingle();

const { data: userData } = !gameUserData?.nickname
  ? await supabaseClient.from('users').select('nickname').eq('id', user.id).maybeSingle()
  : { data: null };

const userNickname = roomData?.host_user_id === user.id
  ? (roomData.host_nickname || gameUserData?.nickname || userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'))
  : (gameUserData?.nickname || userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'));
```

---

## 3. 🟡 투표 결과 처리 로직 오류

### 문제 (processVotingResults, 499-434행)
- `setVotes` 콜백 안에서 `setPlayers`, `setGameResult`, Supabase 업데이트 등 여러 부수 효과 실행
- React 배치 업데이트와 충돌 가능
- 투표 시간 종료 시점의 `votes` 상태가 실시간 구독보다 늦을 수 있음 (다른 클라이언트 투표 반영 안 됨)

### 수정 방향
1. **DB에서 최신 투표 집계 후 처리**
   ```typescript
   const processVotingResults = async () => {
     const { data: playersData } = await supabase
       .from('players')
       .select('nickname, vote_target, role, eliminated')
       .eq('room_code', roomCode);
     
     // vote_target 기준으로 집계
     const voteCounts: Record<string, number> = {};
     playersData?.forEach(p => {
       const target = (p as any).vote_target;
       if (target) voteCounts[target] = (voteCounts[target] || 0) + 1;
     });
     
     const maxVotes = Math.max(...Object.values(voteCounts), 0);
     const eliminatedPlayer = Object.entries(voteCounts)
       .find(([, c]) => c === maxVotes)?.[0] ?? null;
     
     if (eliminatedPlayer) {
       // DB 업데이트, 상태 업데이트 분리
       await supabase.from('players').update({ eliminated: true }).eq('room_code', roomCode).eq('nickname', eliminatedPlayer);
       setPlayers(prev => prev.map(p => p.nickname === eliminatedPlayer ? { ...p, eliminated: true } : p));
       if (eliminatedPlayer === nickname) setIsEliminated(true);
       // 승패 판정...
     }
   };
   ```

2. **setState 콜백 안에서 다른 setState/Supabase 호출 제거** → 순수하게 상태만 반환

---

## 4. 🟡 타이머 useEffect 의존성

### 문제 (423-437행, 440-454행)
- `speakingTimeLeft`, `votingTimeLeft`가 의존성 배열에 있으면, 매초 리렌더 시 effect가 재실행되며 interval이 계속 새로 생성/해제됨
- 동작은 할 수 있으나 비효율적이고, edge case에서 이중 감소 등 버그 가능

### 수정
```typescript
// useRef로 interval 관리, 의존성에서 speakingTimeLeft 제거
const timerRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (gamePhase !== 'SPEAKING') return;
  
  timerRef.current = setInterval(() => {
    setSpeakingTimeLeft(prev => {
      if (prev === null || prev <= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        setGamePhase('VOTING');
        setVotingTimeLeft(15);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  return () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };
}, [gamePhase]);  // speakingTimeLeft 제거
```

---

## 5. 🟡 loadRoom useEffect 의존성

### 문제 (281행)
- `[roomCode, lang, nickname, hasSeenRole]`에 `nickname`, `hasSeenRole` 포함
- `nickname`은 초기 로드 후에 설정되므로, 이 effect가 너무 늦게 또는 여러 번 실행될 수 있음
- 실시간 구독 콜백에서 `checkMyRole()` 호출 시 `nickname`이 아직 없을 수 있음

### 수정
- `nickname`이 없을 때 `checkMyRole` 호출을 건너뛰는 가드 유지
- `hasSeenRole` 변경 시 effect 재실행이 꼭 필요한지 검토 (대부분 불필요할 수 있음)

---

## 6. 🟢 기타 개선

### room_name 필드
- `(room as any).room_name || (room as any).roomName` → DB 컬럼명이 `room_name`으로 통일되어 있다면 `room_name`만 사용

### ChatPanel gamePhase
- `ChatPanel`에 `gamePhase` prop 전달하는데, `ChatPanel` 타입에는 있으나 실제로 채팅 동작에 사용하는지 확인
- 사용하지 않으면 제거해도 됨

### 테마/단어 검증
- `getRandomWord(theme)` 호출 시 `theme`이 빈 문자열이면 `LIAR_WORDS['랜덤']` 사용
- create-room에서 theme 필수이므로, 방 생성 후 theme이 비어 있는 경우는 드물지만 방어 코드 추가 권장

---

## 수정 우선순위

| 순서 | 항목 | 심각도 | 예상 작업 시간 |
|------|------|--------|----------------|
| 1 | DB 마이그레이션 (players, rooms 컬럼) | 🔴 | 10분 |
| 2 | game_users / users 닉네임·is_admin 조회 수정 | 🔴 | 5분 |
| 3 | processVotingResults 리팩터링 (DB 기반 집계) | 🟡 | 20분 |
| 4 | 타이머 useEffect 정리 | 🟡 | 5분 |
| 5 | 기타 개선 | 🟢 | 선택 |

---

## 적용 순서

1. `067_liar_game_schema.sql` 마이그레이션 생성 후 Supabase에 적용
2. `liar_room/[id]/page.tsx`에서 닉네임·is_admin 조회 수정
3. `processVotingResults`를 DB 기반으로 리팩터링
4. 타이머 관련 useEffect 정리

이 순서대로 적용하면 라이어 게임의 주요 오류를 해결할 수 있습니다.
