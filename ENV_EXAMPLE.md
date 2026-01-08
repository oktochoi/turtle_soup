# .env.local 파일 형식

`.env.local` 파일은 프로젝트 루트 디렉토리에 생성하고 다음 형식으로 작성하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=https://yamoijfilvwabzxxxwdw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 중요 사항

1. **따옴표 없이** 작성하세요
   - ❌ 잘못된 예: `NEXT_PUBLIC_SUPABASE_URL="https://..."` 
   - ✅ 올바른 예: `NEXT_PUBLIC_SUPABASE_URL=https://...`

2. **등호(=) 앞뒤에 공백 없이** 작성하세요
   - ❌ 잘못된 예: `NEXT_PUBLIC_SUPABASE_URL = https://...`
   - ✅ 올바른 예: `NEXT_PUBLIC_SUPABASE_URL=https://...`

3. **각 줄 끝에 공백이나 특수문자가 없는지** 확인하세요

4. **파일 저장 후 개발 서버를 재시작**하세요

## 확인 방법

개발 서버를 재시작한 후 브라우저 콘솔에서 다음 메시지가 보여야 합니다:
- ✅ Supabase 환경 변수가 정상적으로 설정되었습니다.

