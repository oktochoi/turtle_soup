import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경 변수 확인 (디버깅용 - 클라이언트 사이드에서만)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const hasUrl = !!supabaseUrl && supabaseUrl !== '';
  const hasKey = !!supabaseKey && supabaseKey !== '';
  
  if (!hasUrl || !hasKey) {
    console.warn('⚠️ Supabase 환경 변수 확인:');
    console.warn(`   URL: ${hasUrl ? '✅ 설정됨' : '❌ 없음'}`);
    if (hasUrl) {
      console.warn(`   URL 값: ${supabaseUrl?.substring(0, 30)}...`);
    }
    console.warn(`   Key: ${hasKey ? '✅ 설정됨' : '❌ 없음'}`);
    if (!hasKey) {
      console.warn(`   Key 값: ${supabaseKey ? `"${supabaseKey.substring(0, 20)}..." (길이: ${supabaseKey.length})` : '(빈 문자열)'}`);
      console.warn('   🔍 .env.local 파일에서 다음을 확인하세요:');
      console.warn('      1. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY= 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY= 로 시작하는지');
      console.warn('      2. 따옴표 없이 작성했는지');
      console.warn('      3. 등호(=) 앞뒤에 공백이 없는지');
      console.warn('      4. 파일 저장 후 개발 서버를 재시작했는지');
    }
    console.warn('📝 .env.local 파일을 확인하고 개발 서버를 재시작하세요.');
    console.warn('   환경 변수는 빌드 타임에 번들에 포함되므로 서버 재시작이 필요합니다.');
  } else {
    console.log('✅ Supabase 환경 변수가 정상적으로 설정되었습니다.');
  }
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );

