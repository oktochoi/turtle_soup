import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string }> }
) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang || 'ko';
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || `/${lang}`;

  // 개발 환경에서는 localhost 사용, 프로덕션에서는 실제 도메인 사용
  const getBaseUrl = () => {
    const origin = requestUrl.origin;
    // 0.0.0.0을 localhost로 변환
    if (origin.includes('0.0.0.0')) {
      return origin.replace('0.0.0.0', 'localhost');
    }
    return origin;
  };

  const baseUrl = getBaseUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('인증 코드 교환 오류:', error);
      return NextResponse.redirect(new URL(`/${lang}/auth/login?error=${encodeURIComponent(error.message)}`, baseUrl));
    }
  }

  // Google 로그인 후 game_users 테이블에 유저 생성/동기화
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (user && !userError) {
      // game_users 테이블에 유저가 있는지 확인
      const { data: existingGameUser } = await supabase
        .from('game_users')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!existingGameUser) {
        // nickname이 없으면 설정 페이지로 리디렉션
        return NextResponse.redirect(new URL(`/${lang}/auth/setup-nickname`, baseUrl));
      } else if (!existingGameUser.nickname || existingGameUser.nickname.trim() === '') {
        // nickname이 비어있으면 설정 페이지로 리디렉션
        return NextResponse.redirect(new URL(`/${lang}/auth/setup-nickname`, baseUrl));
      }
    }
  } catch (error) {
    console.error('유저 동기화 오류:', error);
  }

  return NextResponse.redirect(new URL(next, baseUrl));
}

