// 최신 Supabase SSR 패턴 사용
import { createClient } from './supabase/client';

// 브라우저 클라이언트 인스턴스 생성
export const supabase = createClient();

// 환경 변수 확인 헬퍼 함수 export
export const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return !!(
    supabaseUrl && 
    supabaseKey && 
    supabaseUrl !== '' && 
    supabaseKey !== ''
  );
};

