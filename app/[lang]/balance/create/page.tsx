'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { TOURNAMENT_SIZES } from '@/lib/balance-game';

const MIN_OPTIONS = 8;
const MAX_OPTIONS = 128;

type OptionInput = { text: string; image_url: string };

export default function BalanceCreatePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [tournamentSize, setTournamentSize] = useState<8 | 16 | 32 | 64 | 128>(8);
  const [options, setOptions] = useState<OptionInput[]>(Array(8).fill(null).map(() => ({ text: '', image_url: '' })));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return;
    }
  }, [user, authLoading, router, lang]);

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
    if (!canSubmit || !user) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: game, error: gameErr } = await supabase
        .from('balance_games')
        .insert({
          title: title.trim(),
          thumbnail_url: thumbnailUrl.trim() || null,
          tournament_size: tournamentSize,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (gameErr || !game) {
        setError(gameErr?.message || (lang === 'ko' ? '게임 생성에 실패했습니다.' : 'Failed to create game.'));
        setSubmitting(false);
        return;
      }

      const toInsert = validOptions.map((o, sort_order) => ({
        game_id: game.id,
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

      router.push(`/${lang}/balance/${game.id}`);
    } catch (err: any) {
      setError(err?.message || (lang === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <Link href={`/${lang}/balance`} className="text-slate-400 hover:text-white text-sm">
            <i className="ri-arrow-left-line mr-2" />
            {lang === 'ko' ? '목록으로' : 'Back to list'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
          {lang === 'ko' ? '밸런스 게임 만들기' : 'Create Balance Game'}
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {lang === 'ko'
            ? '선택지는 텍스트 또는 이미지 URL을 입력할 수 있습니다. 둘 다 넣으면 둘 다 표시됩니다.'
            : 'Each option can be text and/or an image URL. Both will be shown if provided.'}
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
              placeholder={lang === 'ko' ? '예: 오늘 점심 뭐 먹을까?' : 'e.g. What’s for lunch?'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              <button type="button" onClick={addOption} disabled={options.length >= MAX_OPTIONS} className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg">
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
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      maxLength={200}
                    />
                    <input
                      type="url"
                      value={opt.image_url}
                      onChange={(e) => setOption(i, 'image_url', e.target.value)}
                      placeholder={lang === 'ko' ? `이미지 URL ${i + 1}` : `Image URL ${i + 1}`}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                    {opt.image_url.trim() && (
                      <div className="relative w-full h-24 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                        <img src={opt.image_url.trim()} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                  {options.length > MIN_OPTIONS && (
                    <button type="button" onClick={() => removeOption(i)} className="px-2 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg text-white text-sm shrink-0">
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
            className="w-full py-3 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold"
          >
            {submitting ? (lang === 'ko' ? '만드는 중...' : 'Creating...') : lang === 'ko' ? '게임 만들기' : 'Create game'}
          </button>
        </form>
      </div>
    </div>
  );
}
