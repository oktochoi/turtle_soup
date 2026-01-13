# XP 이벤트 호출 예시

## 1. 오늘의 문제 참여 (데일리 참여)

**위치**: `app/page.tsx` - 오늘의 문제 클릭 시

```typescript
import { triggerEvent, getOrCreateGuestId } from '@/lib/progress-client';
import { useAuth } from '@/lib/hooks/useAuth';

// 컴포넌트 내부
const { user } = useAuth();
const guestId = getOrCreateGuestId();

// 오늘의 문제 클릭 핸들러
const handleTodayProblemClick = async () => {
  const result = await triggerEvent(
    null, // userId는 서버에서 결정
    user ? null : guestId, // 로그인 안 했으면 guestId
    user?.id || null, // 로그인 했으면 authUserId
    'daily_participate',
    {}
  );

  if (result?.leveledUp) {
    // 레벨업 토스트 표시
    showToast({ type: 'levelup', level: result.newLevel });
  }

  if (result?.unlockedAchievements.length > 0) {
    // 업적 달성 토스트 표시
    result.unlockedAchievements.forEach(achievement => {
      showToast({ type: 'achievement', achievement });
    });
  }

  if (result?.unlockedTitles.length > 0) {
    // 칭호 획득 토스트 표시
    result.unlockedTitles.forEach(title => {
      showToast({ type: 'title', title });
    });
  }
};
```

## 2. 문제 해결 성공 (정답률 80% 이상)

**위치**: `app/problem/[id]/page.tsx` - 정답 제출 후 유사도 계산 완료 시

```typescript
import { triggerEvent, getOrCreateGuestId } from '@/lib/progress-client';
import { useAuth } from '@/lib/hooks/useAuth';

// handleSubmitAnswer 함수 내부
const { user } = useAuth();
const guestId = getOrCreateGuestId();

// 정답 제출 후 유사도가 80% 이상인 경우
if (similarity >= 80) {
  // 질문 개수와 힌트 사용 여부는 이미 알고 있음
  const questionCount = localQuestions.length; // 또는 questions.length
  const usedHint = false; // 힌트 사용 여부 (현재는 힌트 기능이 없으므로 false)

  const result = await triggerEvent(
    null,
    user ? null : guestId,
    user?.id || null,
    'solve_success',
    {
      questionCount: questionCount,
      usedHint: usedHint,
      similarity: similarity,
    }
  );

  // 레벨업/업적/칭호 토스트 표시
  if (result?.leveledUp) {
    showToast({ type: 'levelup', level: result.newLevel });
  }
  result?.unlockedAchievements.forEach(achievement => {
    showToast({ type: 'achievement', achievement });
  });
  result?.unlockedTitles.forEach(title => {
    showToast({ type: 'title', title });
  });
}
```

## 3. 댓글 작성

**위치**: `app/community/[id]/page.tsx` - 댓글 작성 완료 후

```typescript
import { triggerEvent, getOrCreateGuestId } from '@/lib/progress-client';
import { useAuth } from '@/lib/hooks/useAuth';

// handleSubmitComment 함수 내부, 댓글 저장 성공 후
const { user } = useAuth();
const guestId = getOrCreateGuestId();

const result = await triggerEvent(
  null,
  user ? null : guestId,
  user?.id || null,
  'comment',
  {}
);

// 일일 한도 도달 시 gainedXP가 0일 수 있음
if (result && result.gainedXP > 0) {
  // 작은 토스트로 표시 (선택사항)
  console.log(`+${result.gainedXP} XP 획득!`);
}
```

## 4. 게시글 작성

**위치**: `app/community/create/page.tsx` - 게시글 저장 성공 후

```typescript
import { triggerEvent, getOrCreateGuestId } from '@/lib/progress-client';
import { useAuth } from '@/lib/hooks/useAuth';

// handleSubmit 함수 내부, 게시글 저장 성공 후
const { user } = useAuth();
const guestId = getOrCreateGuestId();

const result = await triggerEvent(
  null,
  user ? null : guestId,
  user?.id || null,
  'post',
  {}
);

if (result?.leveledUp) {
  showToast({ type: 'levelup', level: result.newLevel });
}

if (result?.unlockedAchievements.length > 0) {
  result.unlockedAchievements.forEach(achievement => {
    showToast({ type: 'achievement', achievement });
  });
}
```

## 추가 예시: 문제 해결 실패

**위치**: `app/problem/[id]/page.tsx` - 정답 제출 후 유사도가 80% 미만인 경우

```typescript
// 정답 제출 후 유사도가 80% 미만인 경우
if (similarity < 80) {
  const result = await triggerEvent(
    null,
    user ? null : guestId,
    user?.id || null,
    'solve_fail',
    {
      similarity: similarity,
    }
  );

  // 실패해도 작은 XP 획득
  if (result && result.gainedXP > 0) {
    console.log(`+${result.gainedXP} XP 획득 (실패 보상)`);
  }
}
```

## 토스트 표시 예시

컴포넌트에서 토스트를 관리하는 방법:

```typescript
import { useState } from 'react';
import ProgressToast from '@/components/ProgressToast';
import type { Title, Achievement } from '@/types/progress';

type ToastData = {
  type: 'levelup' | 'achievement' | 'title';
  level?: number;
  achievement?: Achievement;
  title?: Title;
};

function MyComponent() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastData[]>([]);

  const showToast = (data: ToastData) => {
    if (toast) {
      // 이미 토스트가 있으면 큐에 추가
      setToastQueue(prev => [...prev, data]);
    } else {
      setToast(data);
    }
  };

  const handleToastClose = () => {
    setToast(null);
    // 큐에서 다음 토스트 표시
    if (toastQueue.length > 0) {
      setTimeout(() => {
        setToast(toastQueue[0]);
        setToastQueue(prev => prev.slice(1));
      }, 300);
    }
  };

  return (
    <>
      {/* 컴포넌트 내용 */}
      <ProgressToast toast={toast} onClose={handleToastClose} />
    </>
  );
}
```

