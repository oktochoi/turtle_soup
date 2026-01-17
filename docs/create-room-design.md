# 라이어 게임 - 방 만들기(Create Room) 화면 설계서

## 1. 개요

### 핵심 컨셉
- **방장(Game Master) 개념 제거**: 방장은 단지 방을 만들고 시작 버튼을 누르는 사람일 뿐
- **시스템 자동 처리**: 게임 규칙/진행/판정은 모두 시스템이 처리
- **자동 사용자 식별**: 방장 정보는 로그인된 유저 정보로 자동 기록 (별도 입력 불필요)

---

## 2. 페이지 구성 요소 (컴포넌트 단위)

### 2.1 메인 컨테이너
```
CreateRoomPage
├── Header (뒤로가기 버튼, 제목)
├── CreateRoomForm
│   ├── RoomNameInput (필수)
│   ├── ThemeSelector (필수)
│   ├── LevelSelector (필수)
│   ├── MaxPlayersSlider (선택, 기본값 6)
│   ├── PrivacyToggle (선택, 기본값 false)
│   └── CreateButton (CTA)
└── InfoMessage (안내 문구)
```

### 2.2 컴포넌트 상세

#### 2.2.1 RoomNameInput
- **타입**: Text Input
- **레이블**: "방 이름"
- **플레이스홀더**: "예: 오늘 저녁 게임방"
- **유효성**: 2~20자
- **에러 메시지**: "방 이름은 2자 이상 20자 이하여야 합니다"

#### 2.2.2 ThemeSelector
- **타입**: Radio Group 또는 Select
- **레이블**: "주제"
- **옵션**:
  - 음식
  - 동물
  - 장소
  - 직업
  - 물건
  - 영화/드라마
  - 스포츠
  - 랜덤
- **기본값**: 없음 (필수 선택)

#### 2.2.3 LevelSelector
- **타입**: Radio Group
- **레이블**: "난이도"
- **옵션**:
  - EASY: 초보 (단어 흔함, 추리 쉬움)
  - NORMAL: 기본
  - HARD: 어려움 (단어 비유/추리 난이도 높음)
- **기본값**: NORMAL

#### 2.2.4 MaxPlayersSlider
- **타입**: Range Slider + 숫자 표시
- **레이블**: "최대 인원"
- **범위**: 3~12
- **기본값**: 6
- **표시**: 슬라이더 + 현재 값 표시

#### 2.2.5 PrivacyToggle
- **타입**: Toggle Switch
- **레이블**: "비공개 방"
- **설명**: "비공개로 설정하면 입장 코드가 필요합니다"
- **기본값**: false (공개)
- **조건부 표시**: true일 때 입장 코드 생성 안내 표시

#### 2.2.6 CreateButton
- **타입**: Primary Button
- **텍스트**: "방 만들기"
- **상태**:
  - 활성화: 모든 필수 입력 완료 + 유효성 통과
  - 비활성화: 필수 입력 미완료 또는 유효성 실패
  - 로딩: 방 생성 중

---

## 3. 유효성 검사 규칙

### 3.1 실시간 검사
```typescript
const validationRules = {
  roomName: {
    required: true,
    minLength: 2,
    maxLength: 20,
    pattern: /^[가-힣a-zA-Z0-9\s]+$/, // 한글, 영문, 숫자, 공백만 허용
    message: {
      required: "방 이름을 입력해주세요",
      minLength: "방 이름은 2자 이상이어야 합니다",
      maxLength: "방 이름은 20자 이하여야 합니다",
      pattern: "특수문자는 사용할 수 없습니다"
    }
  },
  theme: {
    required: true,
    message: "주제를 선택해주세요"
  },
  level: {
    required: true,
    enum: ["EASY", "NORMAL", "HARD"],
    message: "난이도를 선택해주세요"
  },
  maxPlayers: {
    required: false,
    min: 3,
    max: 12,
    default: 6
  },
  isPrivate: {
    required: false,
    default: false
  }
};
```

### 3.2 제출 전 최종 검사
```typescript
const validateBeforeSubmit = (formData) => {
  const errors = {};
  
  // 필수 필드 검사
  if (!formData.roomName || formData.roomName.length < 2 || formData.roomName.length > 20) {
    errors.roomName = "방 이름은 2자 이상 20자 이하여야 합니다";
  }
  
  if (!formData.theme) {
    errors.theme = "주제를 선택해주세요";
  }
  
  if (!formData.level || !["EASY", "NORMAL", "HARD"].includes(formData.level)) {
    errors.level = "난이도를 선택해주세요";
  }
  
  // 선택 필드 검사
  if (formData.maxPlayers && (formData.maxPlayers < 3 || formData.maxPlayers > 12)) {
    errors.maxPlayers = "최대 인원은 3명 이상 12명 이하여야 합니다";
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
```

---

## 4. API 요청/응답 예시

### 4.1 방 생성 API

#### Request
```http
POST /api/rooms/create
Content-Type: application/json
Authorization: Bearer {token}
```

```json
{
  "roomName": "오늘 저녁 게임방",
  "theme": "음식",
  "level": "NORMAL",
  "maxPlayers": 6,
  "isPrivate": false
}
```

#### Response (Success)
```json
{
  "success": true,
  "data": {
    "roomId": "abc123def456",
    "hostUserId": "user-uuid-here",
    "roomName": "오늘 저녁 게임방",
    "theme": "음식",
    "level": "NORMAL",
    "maxPlayers": 6,
    "isPrivate": false,
    "inviteCode": null,
    "status": "LOBBY",
    "currentPlayers": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "inviteLink": "https://app.com/ko/room/abc123def456"
  }
}
```

#### Response (Error)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "방 이름은 2자 이상 20자 이하여야 합니다",
    "field": "roomName"
  }
}
```

### 4.2 데이터 모델

```typescript
interface Room {
  roomId: string;              // UUID 또는 고유 코드
  hostUserId: string;          // 방 생성한 유저 ID (자동)
  roomName: string;            // 2-20자
  theme: string;               // 주제 (enum)
  level: "EASY" | "NORMAL" | "HARD";
  maxPlayers: number;          // 3-12
  isPrivate: boolean;          // 비공개 여부
  inviteCode?: string;         // 비공개일 경우 생성
  status: "LOBBY" | "PLAYING" | "FINISHED";
  currentPlayers: number;      // 현재 참여 인원
  createdAt: string;          // ISO timestamp
  inviteLink: string;          // 초대 링크
}

interface CreateRoomRequest {
  roomName: string;
  theme: string;
  level: "EASY" | "NORMAL" | "HARD";
  maxPlayers?: number;        // 기본값 6
  isPrivate?: boolean;         // 기본값 false
}
```

---

## 5. 방 생성 → 대기실 이동 흐름

### 5.1 흐름도
```
[Create Room 페이지]
    ↓
[사용자 입력 완료]
    ↓
[유효성 검사]
    ↓
[Create 버튼 클릭]
    ↓
[API 호출: POST /api/rooms/create]
    ↓
[성공 응답 수신]
    ↓
[로딩 상태 표시]
    ↓
[방 대기실로 리다이렉트]
    ↓
[Room Lobby 페이지]
    ├── 방 정보 표시
    ├── 참여 인원 표시
    ├── 초대 링크/코드 표시
    └── 시작 버튼 (방장만)
```

### 5.2 대기실 초기 표시 내용

```typescript
// Room Lobby 페이지 초기 상태
{
  roomInfo: {
    roomId: "abc123def456",
    roomName: "오늘 저녁 게임방",
    theme: "음식",
    level: "NORMAL",
    maxPlayers: 6,
    currentPlayers: 1,
    isPrivate: false,
    inviteCode: null,
    status: "LOBBY"
  },
  players: [
    {
      userId: "host-user-id",
      nickname: "방장닉네임",
      isHost: true,
      joinedAt: "2024-01-15T10:30:00Z"
    }
  ],
  canStart: false,  // 최소 3명 미만
  startButtonDisabled: true,
  startButtonMessage: "최소 3명 이상 모이면 시작할 수 있습니다"
}
```

### 5.3 대기실 UI 구성

```
RoomLobbyPage
├── Header
│   ├── 방 이름
│   └── 뒤로가기 버튼
├── RoomInfoCard
│   ├── 주제: 음식
│   ├── 난이도: 기본
│   └── 인원: 1/6
├── PlayersList
│   └── 참여자 목록 (닉네임, 호스트 표시)
├── InviteSection
│   ├── 초대 링크 복사 버튼
│   └── 방 코드 표시 (비공개일 경우)
└── StartButton (방장만 표시)
    ├── 활성화: currentPlayers >= 3
    └── 비활성화: currentPlayers < 3 + 안내 문구
```

---

## 6. 모바일 UI 고려사항

### 6.1 레이아웃
- **세로 스크롤**: 모든 입력 필드를 세로로 배치
- **터치 타겟**: 최소 44px × 44px
- **간격**: 필드 간 최소 16px 간격

### 6.2 입력 필드
- **텍스트 입력**: 전체 너비, 큰 폰트 크기 (최소 16px)
- **라디오 버튼**: 큰 터치 영역, 명확한 레이블
- **슬라이더**: 손가락으로 쉽게 조작 가능한 크기

### 6.3 버튼
- **CTA 버튼**: 하단 고정 (sticky) 또는 페이지 하단
- **너비**: 화면 전체 너비 또는 좌우 여백 16px

### 6.4 반응형 브레이크포인트
```css
/* 모바일 */
@media (max-width: 640px) {
  .container { padding: 16px; }
  .input-field { font-size: 16px; } /* iOS 줌 방지 */
}

/* 태블릿 */
@media (min-width: 641px) and (max-width: 1024px) {
  .container { max-width: 600px; margin: 0 auto; }
}

/* 데스크톱 */
@media (min-width: 1025px) {
  .container { max-width: 800px; margin: 0 auto; }
}
```

---

## 7. UX 문구 가이드

### 7.1 안내 문구
- **페이지 상단**: "방 이름과 주제, 난이도를 정하면 바로 시작할 수 있어요."
- **최대 인원**: "3명부터 12명까지 함께 플레이할 수 있어요."
- **비공개 방**: "비공개로 설정하면 입장 코드가 필요합니다."
- **시작 버튼 비활성화**: "최소 3명 이상 모이면 시작할 수 있습니다."

### 7.2 에러 메시지
- **방 이름 미입력**: "방 이름을 입력해주세요"
- **방 이름 길이**: "방 이름은 2자 이상 20자 이하여야 합니다"
- **주제 미선택**: "주제를 선택해주세요"
- **난이도 미선택**: "난이도를 선택해주세요"

### 7.3 성공 메시지
- **방 생성 성공**: "방이 생성되었습니다!"
- **초대 링크 복사**: "초대 링크가 복사되었습니다"

---

## 8. UI 디자인 톤

### 8.1 색상 팔레트 (Warm Gray + Olive 테마)
```css
:root {
  /* 배경 */
  --bg-primary: #0E0D0B;
  --bg-surface: #171614;
  --bg-surface-2: #1A1916;
  
  /* 테두리 */
  --border: #2A2824;
  --border-hover: #3A3834;
  
  /* 텍스트 */
  --text-primary: #F1F0ED;
  --text-secondary: #A8A29E;
  --text-disabled: #6B6864;
  
  /* 액센트 */
  --accent: #A3B18A;
  --accent-hover: #7F8F69;
  --accent-disabled: #5A6450;
  
  /* 상태 */
  --error: #F87171;
  --success: #A3B18A;
  --warning: #FBBF24;
}
```

### 8.2 타이포그래피
- **제목**: 24px, Bold
- **레이블**: 14px, Medium
- **본문**: 16px, Regular
- **서브텍스트**: 12px, Regular

### 8.3 간격 시스템
- **컨테이너 패딩**: 16px (모바일), 24px (데스크톱)
- **필드 간격**: 24px
- **카드 패딩**: 20px
- **버튼 패딩**: 12px 24px

### 8.4 카드 스타일
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
}
```

### 8.5 버튼 스타일
```css
.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  background: var(--accent-disabled);
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## 9. 구현 체크리스트

### 9.1 프론트엔드
- [ ] CreateRoomPage 컴포넌트 생성
- [ ] RoomNameInput 컴포넌트 (유효성 검사 포함)
- [ ] ThemeSelector 컴포넌트
- [ ] LevelSelector 컴포넌트
- [ ] MaxPlayersSlider 컴포넌트
- [ ] PrivacyToggle 컴포넌트
- [ ] CreateButton 컴포넌트
- [ ] 유효성 검사 로직 구현
- [ ] API 호출 로직 구현
- [ ] 로딩 상태 처리
- [ ] 에러 처리 및 표시
- [ ] 성공 시 리다이렉트
- [ ] 모바일 반응형 스타일

### 9.2 백엔드
- [ ] POST /api/rooms/create 엔드포인트
- [ ] 요청 유효성 검사
- [ ] 방 ID 생성 로직
- [ ] 비공개 방일 경우 inviteCode 생성
- [ ] 데이터베이스 저장
- [ ] 초대 링크 생성
- [ ] 응답 반환

### 9.3 데이터베이스
- [ ] rooms 테이블 스키마 확인/수정
- [ ] 필수 필드: roomId, hostUserId, roomName, theme, level, maxPlayers, isPrivate, status
- [ ] 선택 필드: inviteCode
- [ ] 인덱스: roomId, hostUserId, status

---

## 10. 다음 단계

1. **Room Lobby 페이지 구현**: 방 대기실 UI 및 실시간 참여자 업데이트
2. **게임 시작 로직**: 최소 인원 체크 및 게임 상태 전환
3. **초대 링크 공유**: 소셜 공유 기능
4. **실시간 업데이트**: WebSocket 또는 Supabase Realtime을 통한 실시간 상태 동기화

