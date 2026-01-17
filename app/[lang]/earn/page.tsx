'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function EarnPage({ params }: { params: Promise<{ lang: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [remainingClaims, setRemainingClaims] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      // 남은 클레임 횟수 조회
      const { data: remaining, error: remainingError } = await supabase.rpc(
        'rpc_get_daily_claims_remaining'
      );

      if (remainingError) {
        console.error('Remaining claims error:', remainingError);
      } else {
        setRemainingClaims(remaining || 0);
      }

      // 코인 잔액 조회
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('coins')
        .eq('user_id', user.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        console.error('Wallet load error:', walletError);
      } else {
        setCoins(wallet?.coins || 0);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (remainingClaims <= 0) {
      alert('오늘의 보상 횟수를 모두 사용했습니다. 내일 다시 시도해주세요.');
      return;
    }

    if (isClaiming) return;

    // Flutter 앱에서 호출할 수 있도록 이벤트 발생
    // 실제로는 Flutter에서 Rewarded Ad를 표시하고 완료 후 이 함수를 호출
    alert('Flutter 앱에서 광고를 시청해주세요. (개발 중)');
    
    // 임시: 테스트용 클레임
    await claimReward('test_claim_key_' + Date.now(), 10, 'test_ad_unit');
  };

  const claimReward = async (claimKey: string, rewardCoins: number, adUnit?: string) => {
    setIsClaiming(true);

    try {
      const response = await fetch('/api/coins/claim-rewarded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_key: claimKey,
          reward_coins: rewardCoins,
          ad_unit: adUnit,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`${rewardCoins} 코인을 받았습니다!`);
        loadData();
      } else {
        alert(`보상 받기 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Claim reward error:', error);
      alert('보상 받기 중 오류가 발생했습니다.');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-8">로딩 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">코인 획득</h1>
          <div className="text-xl font-semibold text-teal-400">
            {coins.toLocaleString()} 코인
          </div>
        </div>

        {/* 광고 보상 카드 */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-8 border border-yellow-500/30 text-center space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">광고 보고 코인 받기</h2>
            <p className="text-slate-300">
              광고를 시청하면 코인을 받을 수 있습니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-4xl font-bold text-yellow-400">
              +10 코인
            </div>
            <div className="text-slate-400">
              오늘 남은 횟수: <span className="font-bold text-white">{remainingClaims}회</span>
            </div>
          </div>

          <button
            onClick={handleWatchAd}
            disabled={remainingClaims <= 0 || isClaiming}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
              remainingClaims > 0 && !isClaiming
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-slate-600 cursor-not-allowed text-slate-400'
            }`}
          >
            {isClaiming
              ? '처리 중...'
              : remainingClaims > 0
              ? '광고 시청하기'
              : '오늘의 횟수 소진'}
          </button>

          {remainingClaims <= 0 && (
            <p className="text-sm text-slate-400">
              오늘의 보상 횟수를 모두 사용했습니다. 내일 다시 시도해주세요.
            </p>
          )}
        </div>

        {/* 안내 */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="font-semibold mb-2">안내사항</h3>
          <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
            <li>하루 최대 10회까지 보상을 받을 수 있습니다.</li>
            <li>광고 시청을 완료해야 코인을 받을 수 있습니다.</li>
            <li>보상은 매일 자정에 초기화됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

