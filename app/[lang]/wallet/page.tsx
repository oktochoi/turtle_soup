'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';

interface Transaction {
  id: string;
  type: 'earn' | 'spend' | 'iap';
  amount: number;
  source: 'rewarded_ad' | 'shop' | 'iap';
  created_at: string;
}

export default function WalletPage({ params }: { params: Promise<{ lang: string }> }) {
  const { user } = useAuth();
  const t = useTranslations();
  const [coins, setCoins] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWallet();
    }
  }, [user]);

  const loadWallet = async () => {
    if (!user) return;

    try {
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

      // 거래 내역 조회
      const { data: txData, error: txError } = await supabase
        .from('coin_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txError) {
        console.error('Transactions load error:', txError);
      } else {
        setTransactions(txData || []);
      }
    } catch (error) {
      console.error('Load wallet error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionLabel = (tx: Transaction) => {
    if (tx.type === 'earn') {
      return '광고 보상';
    } else if (tx.type === 'iap') {
      return '코인 구매';
    } else {
      return '아이템 구매';
    }
  };

  const getTransactionColor = (tx: Transaction) => {
    if (tx.type === 'earn' || tx.type === 'iap') {
      return 'text-green-400';
    }
    return 'text-red-400';
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
        {/* 코인 잔액 */}
        <div className="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-xl p-6 border border-teal-500/30">
          <h1 className="text-2xl font-bold mb-2">코인 지갑</h1>
          <div className="text-5xl font-bold text-teal-400">
            {coins.toLocaleString()} 코인
          </div>
        </div>

        {/* 거래 내역 */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">거래 내역</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              거래 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{getTransactionLabel(tx)}</div>
                    <div className="text-sm text-slate-400">
                      {new Date(tx.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div className={`text-lg font-bold ${getTransactionColor(tx)}`}>
                    {tx.type === 'spend' ? '-' : '+'}
                    {tx.amount.toLocaleString()} 코인
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

