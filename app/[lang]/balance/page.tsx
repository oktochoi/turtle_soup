'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type BalanceGame = {
  id: string;
  title: string;
  tournament_size: number;
  created_at: string;
  thumbnail_url?: string | null;
  option_count?: number;
  play_count?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
};

export default function BalanceListPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const [games, setGames] = useState<BalanceGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: gamesData, error } = await supabase
        .from('balance_games')
        .select('id, title, tournament_size, created_at, thumbnail_url, view_count, like_count')
        .order('created_at', { ascending: false });

      if (error) {
        setGames([]);
        setLoading(false);
        return;
      }

      const withCounts = await Promise.all(
        (gamesData || []).map(async (g) => {
          const { count: optCount } = await supabase
            .from('balance_game_options')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', g.id);
          const { count: playCount } = await supabase
            .from('balance_game_plays')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', g.id);
          const { count: commentCount } = await supabase
            .from('balance_game_comments')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', g.id);
          return {
            ...g,
            option_count: optCount ?? 0,
            play_count: playCount ?? 0,
            view_count: g.view_count ?? 0,
            like_count: g.like_count ?? 0,
            comment_count: commentCount ?? 0,
          };
        })
      );
      setGames(withCounts);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/${lang}`} className="text-slate-400 hover:text-white text-sm">
            <i className="ri-arrow-left-line mr-2" />
            {lang === 'ko' ? '뒤로' : 'Back'}
          </Link>
          <Link
            href={`/${lang}/balance/create`}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-sm font-medium"
          >
            {lang === 'ko' ? '게임 만들기' : 'Create Game'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
          {lang === 'ko' ? '밸런스 게임' : 'Balance Game'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {lang === 'ko'
            ? '둘 중 하나를 선택해 결승까지 가는 토너먼트입니다.'
            : 'Choose one of two in each round until the final.'}
        </p>

        {games.length === 0 ? (
          <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
            <i className="ri-scales-line text-4xl text-slate-500 mb-4" />
            <p className="text-slate-400 mb-4">
              {lang === 'ko' ? '아직 게임이 없습니다.' : 'No games yet.'}
            </p>
            <Link href={`/${lang}/balance/create`} className="text-teal-400 hover:underline">
              {lang === 'ko' ? '첫 게임 만들기' : 'Create first game'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {games.map((g) => (
              <Link
                key={g.id}
                href={`/${lang}/balance/${g.id}`}
                className="block bg-slate-800/80 hover:bg-slate-700/80 rounded-xl overflow-hidden border border-slate-700 transition-colors active:scale-[0.98] transition-transform"
              >
                <div className="aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                  {g.thumbnail_url ? (
                    <img src={g.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <i className="ri-scales-line text-4xl text-slate-600" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold text-white text-sm line-clamp-2">{g.title}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                    <span>{g.tournament_size}{lang === 'ko' ? '강' : ''}</span>
                    <span className="flex items-center gap-0.5"><i className="ri-eye-line" /> {g.view_count ?? 0}</span>
                    <span className="flex items-center gap-0.5"><i className="ri-heart-line" /> {g.like_count ?? 0}</span>
                    <span className="flex items-center gap-0.5"><i className="ri-chat-3-line" /> {g.comment_count ?? 0}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
