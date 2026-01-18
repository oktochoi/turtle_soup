import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lang: string }> }
) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang || 'ko';
  
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const next = requestUrl.searchParams.get('next') || `/${lang}`;

  if (error) {
    console.error('OAuth 에러:', error);
    return NextResponse.redirect(
      new URL(`/${lang}/auth/login?error=${encodeURIComponent(error)}`, requestUrl.origin)
    );
  }

  if (code) {
    try {
      const supabase = await createClient();
      
      // 세션 교환 (쿠키에서 code verifier를 자동으로 읽음)
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error('세션 교환 실패:', sessionError);
        return NextResponse.redirect(
          new URL(`/${lang}/auth/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
        );
      }

      if (data?.session) {
        // OAuth 로그인 후 users 테이블 동기화 확인
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (user && !userError) {
            // game_users 테이블에 유저가 있는지 확인
            const { data: existingGameUser } = await supabase
              .from('game_users')
              .select('*')
              .eq('auth_user_id', user.id)
              .maybeSingle();

            if (!existingGameUser || !existingGameUser.nickname || existingGameUser.nickname.trim() === '') {
              // nickname이 없으면 설정 페이지로 리디렉션
              return NextResponse.redirect(
                new URL(`/${lang}/auth/setup-nickname`, requestUrl.origin)
              );
            }
          }
        } catch (error) {
          console.error('유저 동기화 오류:', error);
        }

        // 로그인 성공 시 홈으로 리디렉션
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
    } catch (err: any) {
      console.error('콜백 처리 실패:', err);
      return NextResponse.redirect(
        new URL(`/${lang}/auth/login?error=${encodeURIComponent(err.message || 'Unknown error')}`, requestUrl.origin)
      );
    }
  }

  // 코드가 없으면 메인으로
  return NextResponse.redirect(new URL(`/${lang}`, requestUrl.origin));
}

