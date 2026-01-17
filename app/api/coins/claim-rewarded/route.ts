import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { claim_key, reward_coins, ad_unit } = body;

    if (!claim_key || !reward_coins || reward_coins <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    // RPC 호출
    const { data, error } = await supabase.rpc('rpc_claim_rewarded', {
      p_claim_key: claim_key,
      p_reward_coins: reward_coins,
      p_ad_unit: ad_unit || null,
    });

    if (error) {
      console.error('Rewarded claim error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Claim rewarded error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

