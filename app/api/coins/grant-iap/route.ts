import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// 간단한 검증 함수 (실제로는 Google Play / App Store API 호출 필요)
async function verifyPurchase(
  platform: 'android' | 'ios',
  productId: string,
  purchaseToken: string
): Promise<{ valid: boolean; coins: number }> {
  // TODO: 실제 검증 로직 구현
  // Android: Google Play Developer API
  // iOS: App Store Server API
  
  // 임시: product_id 기반 코인 매핑
  const coinMap: Record<string, number> = {
    'coins_100': 100,
    'coins_500': 500,
    'coins_1000': 1000,
    'coins_5000': 5000,
  };

  const coins = coinMap[productId] || 0;
  
  // 실제 환경에서는 purchase_token을 검증해야 함
  return { valid: coins > 0, coins };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { product_id, purchase_token, platform } = body;

    if (!product_id || !purchase_token || !platform) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    if (platform !== 'android' && platform !== 'ios') {
      return NextResponse.json(
        { success: false, error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // 구매 검증
    const verification = await verifyPurchase(platform, product_id, purchase_token);
    
    if (!verification.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid purchase' },
        { status: 400 }
      );
    }

    // RPC 호출
    const { data, error } = await supabase.rpc('rpc_grant_iap', {
      p_product_id: product_id,
      p_purchase_token: purchase_token,
      p_platform: platform,
      p_coins_granted: verification.coins,
    });

    if (error) {
      console.error('Grant IAP error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Grant IAP error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

