# 바다거북스프게임

추리와 질문으로 진실을 밝혀내는 바다거북스프 게임입니다. Supabase를 사용하여 실시간으로 여러 사용자가 함께 플레이할 수 있습니다.

## 기능

- 🎮 실시간 멀티플레이어 게임
- 💬 질문과 답변을 통한 추리 게임
- 📱 반응형 디자인 (모바일, 태블릿, 데스크톱 지원)
- ⚡ Supabase Realtime을 통한 실시간 동기화

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트를 생성합니다.
2. 프로젝트 설정에서 API URL과 Anon Key를 확인합니다.
3. `.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_publishable_key_here
```

또는 기존 anon key를 사용하는 경우:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. 데이터베이스 스키마 설정

Supabase 대시보드의 SQL Editor에서 `supabase/schema.sql` 파일의 내용을 실행하여 데이터베이스 스키마를 생성합니다.

또는 Supabase CLI를 사용하는 경우:

```bash
supabase db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 게임 방법

1. **방 만들기**: 관리자로 새 방을 만들고 이야기와 진실을 설정합니다.
2. **방 참여**: 방 코드를 입력하여 게임에 참여합니다.
3. **질문하기**: 참여자는 예/아니오/상관없음으로 답변 가능한 질문을 합니다.
4. **답변하기**: 관리자는 질문에 대해 예/아니오/상관없음으로 답변합니다.
5. **정답 추측**: 참여자는 진실을 추측하여 제출합니다.
6. **게임 종료**: 관리자가 정답을 확인하면 게임이 종료되고 진실이 공개됩니다.

## 기술 스택

- **Next.js 15** - React 프레임워크
- **TypeScript** - 타입 안정성
- **Tailwind CSS** - 스타일링
- **Supabase** - 백엔드 및 실시간 데이터베이스
- **Supabase Realtime** - 실시간 동기화

## 프로젝트 구조

```
turtle_soup/
├── app/                    # Next.js 앱 라우터
│   ├── page.tsx           # 홈 페이지
│   ├── create-room/        # 방 생성 페이지
│   └── room/[code]/        # 게임 방 페이지
├── lib/                    # 유틸리티 및 설정
│   ├── supabase.ts        # Supabase 클라이언트
│   └── types.ts            # TypeScript 타입 정의
├── supabase/              # 데이터베이스 스키마
│   └── schema.sql         # SQL 스키마
└── package.json           # 프로젝트 의존성
```

## 환경 변수

`.env.local` 파일에 다음 변수들을 설정해야 합니다:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key

## 빌드

프로덕션 빌드를 생성하려면:

```bash
npm run build
```

## 라이선스

이 프로젝트는 개인 사용을 위한 것입니다.
