'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price_coins: number;
}

export default function ShopPage({ params }: { params: Promise<{ lang: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [coins, setCoins] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadShop();
      loadWallet();
    }
  }, [user]);

  const loadShop = async () => {
    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('price_coins', { ascending: true });

      if (error) {
        console.error('Shop load error:', error);
      } else {
        setItems(data || []);
      }
    } catch (error) {
      console.error('Load shop error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWallet = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_wallets')
        .select('coins')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Wallet load error:', error);
      } else {
        setCoins(data?.coins || 0);
      }
    } catch (error) {
      console.error('Load wallet error:', error);
    }
  };

  const handleBuy = async (itemId: string, price: number) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (coins < price) {
      alert('코인이 부족합니다.');
      return;
    }

    if (buyingItemId) return; // 이미 구매 중

    setBuyingItemId(itemId);

    try {
      const response = await fetch('/api/coins/buy-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, quantity: 1 }),
      });

      const result = await response.json();

      if (result.success) {
        alert('구매 완료!');
        loadWallet();
        loadShop();
      } else {
        alert(`구매 실패: ${result.error}`);
      }
    } catch (error) {
      console.error('Buy item error:', error);
      alert('구매 중 오류가 발생했습니다.');
    } finally {
      setBuyingItemId(null);
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
          <h1 className="text-3xl font-bold">상점</h1>
          <div className="flex items-center gap-4">
            <div className="text-xl font-semibold text-teal-400">
              {coins.toLocaleString()} 코인
            </div>
            <button
              onClick={() => router.push('/wallet')}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
            >
              지갑
            </button>
          </div>
        </div>

        {/* 아이템 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4"
            >
              <div>
                <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
                <p className="text-sm text-slate-400">{item.description}</p>
                <div className="mt-2">
                  <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                    {item.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-teal-400">
                  {item.price_coins.toLocaleString()} 코인
                </div>
                <button
                  onClick={() => handleBuy(item.id, item.price_coins)}
                  disabled={buyingItemId === item.id || coins < item.price_coins}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    coins >= item.price_coins
                      ? 'bg-teal-500 hover:bg-teal-600'
                      : 'bg-slate-600 cursor-not-allowed'
                  }`}
                >
                  {buyingItemId === item.id ? '구매 중...' : '구매'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            판매 중인 아이템이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

