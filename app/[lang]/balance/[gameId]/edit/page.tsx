'use client';

import { use } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TOURNAMENT_SIZES } from '@/lib/balance-game';

const MIN_OPTIONS = 8;
const MAX_OPTIONS = 128;

type OptionInput = { id?: string; text: string; image_url: string };

export default function BalanceEditPage({ params }: { params: Promise<{ lang: string; gameId: string }> }) {
  const { lang, gameId } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tournamentSize, setTournamentSize] = useState<8 | 16 | 32 | 64 | 128>(8);
  const [options, setOptions] = useState<OptionInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);

  const loadGame = useCallback(async () => {
    if (!gameId || !user) return;
    const supabase = createClient();
    const { data: game, error: gameErr } = await supabase
      .from('balance_games')
      .select('id, title, thumbnail_url, tournament_size, created_by')
      .eq('id', gameId)
      .single();
    if (gameErr || !game) {
      setLoading(false);
      router.push(`/${lang}/balance`);
      return;
    }
    if (game.created_by !== user.id) {
      setLoading(false);
      router.push(`/${lang}/balance/${gameId}`);
      return;
    }
    setIsCreator(true);
    setTitle(game.title);
    setThumbnailUrl(game.thumbnail_url || '');
    setTournamentSize(game.tournament_size as 8 | 16 | 32 | 64 | 128);

    const { data: opts, error: optsErr } = await supabase
      .from('balance_game_options')
      .select('id, text, image_url')
      .eq('game_id', gameId)
      .order('sort_order');
    if (optsErr) {
      setLoading(false);
      return;
    }
    setOptions(
      (opts || []).map((o) => ({
        id: o.id,
        text: o.text || '',
        image_url: o.image_url || '',
      }))
    );
    if (!opts?.length) {
      setOptions(Array(8).fill(null).map(() => ({ text: '', image_url: '' })));
    }
    setLoading(false);
  }, [gameId, user, lang, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return;
    }
    loadGame();
  }, [user, authLoading, router, lang, loadGame]);

  const validOptions = options.filter((o) => o.text.trim() || o.image_url.trim());
  const canSubmit =
    title.trim().length >= 1 &&
    validOptions.length >= tournamentSize &&
    validOptions.length >= MIN_OPTIONS &&
    validOptions.length <= MAX_OPTIONS;

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions([...options, { text: '', image_url: '' }]);
  };
  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index));
  };
  const setOption = (index: number, field: 'text' | 'image_url', value: string) => {
    const next = [...options];
    next[index] = { ...next[index], [field]: value };
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit || !user || !gameId) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: gameErr } = await supabase
        .from('balance_games')
        .update({
          title: title.trim(),
          thumbnail_url: thumbnailUrl.trim() || null,
          tournament_size: tournamentSize,
        })
        .eq('id', gameId)
        .eq('created_by', user.id);

      if (gameErr) {
        setError(gameErr.message || (lang === 'ko' ? '수정에 실패했습니다.' : 'Update failed.'));
        setSubmitting(false);
        return;
      }

      await supabase.from('balance_game_options').delete().eq('game_id', gameId);

      const toInsert = validOptions.map((o, sort_order) => ({
        game_id: gameId,
        text: o.text.trim() || '',
        image_url: o.image_url.trim() || null,
        sort_order,
      }));
      const { error: optErr } = await supabase.from('balance_game_options').insert(toInsert);
      if (optErr) {
        setError(optErr.message);
        setSubmitting(false);
        return;
      }

      router.push(`/${lang}/balance/${gameId}`);
    } catch (err: any) {
      setError(err?.message || (lang === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  if (!isCreator) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-8">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between gap-2 mb-6 min-h-[44px]">
          <Link href={`/${lang}/balance/${gameId}`} className="text-slate-400 hover:text-white text-sm py-2 -ml-1 flex items-center">
            <i className="ri-arrow-left-line mr-2" />
            {lang === 'ko' ? '취소' : 'Cancel'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
          {lang === 'ko' ? '밸런스 게임 수정' : 'Edit Balance Game'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {lang === 'ko' ? '제목, 썸네일, 토너먼트 크기, 선택지를 수정할 수 있습니다.' : 'You can edit title, thumbnail, tournament size, and options.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {lang === 'ko' ? '게임 제목' : 'Game title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ko' ? '예: 오늘 점심 뭐 먹을까?' : 'e.g. What\'s for lunch?'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {lang === 'ko' ? '썸네일 이미지 URL (선택)' : 'Thumbnail image URL (optional)'}
            </label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
            />
            {thumbnailUrl.trim() && (
              <div className="mt-2 w-full max-w-xs aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                <img src={thumbnailUrl.trim()} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {lang === 'ko' ? '토너먼트 크기' : 'Tournament size'}
            </label>
            <select
              value={tournamentSize}
              onChange={(e) => setTournamentSize(Number(e.target.value) as 8 | 16 | 32 | 64 | 128)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
            >
              {TOURNAMENT_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'ko' ? `선택지는 최소 ${tournamentSize}개 이상 필요합니다.` : `At least ${tournamentSize} options required.`}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                {lang === 'ko' ? '선택지 (8~128개)' : 'Options (8–128)'}
              </label>
              <button type="button" onClick={addOption} disabled={options.length >= MAX_OPTIONS} className="text-xs px-3 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg min-h-[44px] touch-manipulation">
                + {lang === 'ko' ? '추가' : 'Add'}
              </button>
            </div>
            <div className="space-y-4 max-h-[28rem] overflow-y-auto">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => setOption(i, 'text', e.target.value)}
                      placeholder={lang === 'ko' ? `텍스트 (선택) ${i + 1}` : `Text (optional) ${i + 1}`}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm min-h-[44px]"
                      maxLength={200}
                    />
                    <input
                      type="url"
                      value={opt.image_url}
                      onChange={(e) => setOption(i, 'image_url', e.target.value)}
                      placeholder={lang === 'ko' ? `이미지 URL ${i + 1}` : `Image URL ${i + 1}`}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm min-h-[44px]"
                    />
                    {opt.image_url.trim() && (
                      <div className="relative w-full h-24 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                        <img src={opt.image_url.trim()} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                  {options.length > MIN_OPTIONS && (
                    <button type="button" onClick={() => removeOption(i)} className="px-3 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg text-white text-sm shrink-0 min-h-[44px] touch-manipulation">
                      <i className="ri-close-line" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {validOptions.length} / {tournamentSize} {lang === 'ko' ? '(필요)' : 'required'} · {MAX_OPTIONS} {lang === 'ko' ? '개까지' : 'max'}
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full py-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold min-h-[52px] touch-manipulation"
          >
            {submitting ? (lang === 'ko' ? '저장 중...' : 'Saving...') : lang === 'ko' ? '저장' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
