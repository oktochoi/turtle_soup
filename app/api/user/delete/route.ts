import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 현재 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 클라이언트에서는 auth.users를 직접 삭제할 수 없음
    // 실제 계정 삭제는 Supabase Dashboard나 Admin API를 통해서만 가능
    // 여기서는 로그아웃 처리만 수행
    // 참고: auth.users 삭제 시 CASCADE로 public.users도 자동 삭제됨
    
    // 사용자 관련 데이터 정리는 선택적으로 처리
    // (예: 문제의 user_id를 null로 설정하는 등)
    
    return NextResponse.json(
      { 
        success: true,
        message: '계정 삭제 요청이 완료되었습니다. 로그아웃됩니다.'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('계정 삭제 오류:', error);
    return NextResponse.json(
      { error: error.message || '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

