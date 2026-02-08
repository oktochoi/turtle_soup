'use client';

import { use } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getTotalRounds,
  getRound1Matches,
  getNextRoundMatches,
  shuffleInPlace,
  type TournamentSize,
  type Match,
} from '@/lib/balance-game';

const SESSION_KEY = 'balance_game_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type OptionRecord = { id: string; text: string; image_url?: string | null };
type ChoiceRow = { round_number: number; match_index: number; chosen_option_id: string };

type PlayRow = { id: string; shuffled_option_ids: string[]; completed_at: string | null };

function getWinnersForRound(choices: ChoiceRow[], roundNumber: number): string[] {
  return choices
    .filter((c) => c.round_number === roundNumber)
    .sort((a, b) => a.match_index - b.match_index)
    .map((c) => c.chosen_option_id);
}

function getMatchesForRound(
  roundNumber: number,
  shuffledIds: string[],
  choices: ChoiceRow[],
  size: TournamentSize
): Match[] {
  if (roundNumber === 1) return getRound1Matches(shuffledIds);
  const winners = getWinnersForRound(choices, roundNumber - 1);
  return getNextRoundMatches(winners);
}

/** 현재 라운드를 128강·64강·…·결승 형식으로 표시 */
function getRoundLabel(roundNumber: number, tournamentSize: TournamentSize, totalRounds: number, lang: string): string {
  if (roundNumber > totalRounds) return lang === 'ko' ? '결승' : 'Final';
  const n = tournamentSize / Math.pow(2, roundNumber - 1);
  if (n <= 2) return lang === 'ko' ? '결승' : 'Final';
  return lang === 'ko' ? `${n}강` : `Round of ${n}`;
}

export default function BalancePlayPage({ params }: { params: Promise<{ lang: string; gameId: string }> }) {
  const { lang, gameId } = use(params);
  const searchParams = useSearchParams();
  const forceNewPlay = searchParams.get('new') === '1';
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [optionsMap, setOptionsMap] = useState<Record<string, OptionRecord>>({});
  const [playId, setPlayId] = useState<string | null>(null);
  const [shuffledIds, setShuffledIds] = useState<string[]>([]);
  const [choices, setChoices] = useState<ChoiceRow[]>([]);
  const [tournamentSize, setTournamentSize] = useState<TournamentSize>(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [pathSummary, setPathSummary] = useState<{ round: number; text: string }[]>([]);
  const [finalOptionId, setFinalOptionId] = useState<string | null>(null);
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({});
  const viewCountUpdatedRef = useRef<string | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState<{ id: string; content: string; user_nickname: string; created_at: string }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const router = useRouter();

  const totalRounds = getTotalRounds(tournamentSize);

  const loadGame = useCallback(async () => {
    const supabase = createClient();

    const { data: game, error: gameErr } = await supabase
      .from('balance_games')
      .select('id, title, tournament_size, view_count, like_count, thumbnail_url, created_by')
      .eq('id', gameId)
      .single();
    if (gameErr || !game) {
      setLoading(false);
      return;
    }
    setTitle(game.title);
    setTournamentSize(game.tournament_size as TournamentSize);
    setViewCount(game.view_count ?? 0);
    setLikeCount(game.like_count ?? 0);
    setThumbnailUrl(game.thumbnail_url ?? null);
    setCreatedBy(game.created_by ?? null);

    if (!forceNewPlay) {
      if (viewCountUpdatedRef.current !== gameId) {
        await supabase.rpc('increment_balance_game_view_count', { game_id: gameId });
        viewCountUpdatedRef.current = gameId;
        setViewCount((v) => v + 1);
      }
      if (user) {
        const { data: likeRow } = await supabase
          .from('balance_game_likes')
          .select('id')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsLiked(!!likeRow);
      }
      const { data: commentRows } = await supabase
        .from('balance_game_comments')
        .select('id, content, user_id, created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (commentRows?.length) {
        const userIds = [...new Set(commentRows.map((c: { user_id: string }) => c.user_id))];
        const { data: usersData } = await supabase.from('users').select('id, nickname').in('id', userIds);
        const { data: gameUsersData } = await supabase.from('game_users').select('auth_user_id, nickname').in('auth_user_id', userIds);
        const usersMap = new Map((usersData || []).map((u: { id: string; nickname: string }) => [u.id, u.nickname]));
        const gameUsersMap = new Map((gameUsersData || []).map((gu: { auth_user_id: string; nickname: string }) => [gu.auth_user_id, gu.nickname]));
        setComments(
          commentRows.map((c: { id: string; content: string; user_id: string; created_at: string }) => ({
            id: c.id,
            content: c.content,
            user_nickname: gameUsersMap.get(c.user_id) || usersMap.get(c.user_id) || 'User',
            created_at: c.created_at,
          }))
        );
      } else {
        setComments([]);
      }
      setLoading(false);
      return;
    }

    const { data: opts, error: optsErr } = await supabase
      .from('balance_game_options')
      .select('id, text, image_url')
      .eq('game_id', gameId)
      .order('sort_order');
    if (optsErr || !opts?.length) {
      setLoading(false);
      return;
    }
    const map: Record<string, OptionRecord> = {};
    opts.forEach((o) => { map[o.id] = { id: o.id, text: o.text || '', image_url: o.image_url ?? null }; });
    setOptionsMap(map);

    const sessionId = getOrCreateSessionId();
    let existingPlay: PlayRow | null = null;
    if (!forceNewPlay) {
      const { data } = await supabase
        .from('balance_game_plays')
        .select('id, shuffled_option_ids, completed_at')
        .eq('game_id', gameId)
        .or(user?.id ? `user_id.eq.${user.id},session_id.eq.${sessionId}` : `session_id.eq.${sessionId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existingPlay = data as PlayRow | null;
    }

    let play: PlayRow;
    if (existingPlay?.id && existingPlay.shuffled_option_ids?.length && !forceNewPlay) {
      play = {
        id: existingPlay.id,
        shuffled_option_ids: existingPlay.shuffled_option_ids as string[],
        completed_at: existingPlay.completed_at,
      };
    } else {
      const optionIds = opts.map((o) => o.id);
      const shuffled = shuffleInPlace([...optionIds]).slice(0, game.tournament_size);
      const { data: newPlay, error: insertErr } = await supabase
        .from('balance_game_plays')
        .insert({
          game_id: gameId,
          user_id: user?.id ?? null,
          session_id: user ? null : sessionId,
          shuffled_option_ids: shuffled,
        })
        .select('id, shuffled_option_ids, completed_at')
        .single();
      if (insertErr || !newPlay) {
        setLoading(false);
        return;
      }
      play = {
        id: newPlay.id,
        shuffled_option_ids: (newPlay.shuffled_option_ids as string[]) || shuffled,
        completed_at: newPlay.completed_at,
      };
    }

    setPlayId(play.id);
    setShuffledIds(play.shuffled_option_ids);

    if (play.completed_at) {
      setCompleted(true);
      const { data: choiceRows } = await supabase
        .from('balance_game_choices')
        .select('round_number, match_index, chosen_option_id')
        .eq('play_id', play.id)
        .order('round_number')
        .order('match_index');
      const choiceList = (choiceRows || []) as ChoiceRow[];
      setChoices(choiceList);
      const lastRound = totalRounds;
      const lastChoice = choiceList.filter((c) => c.round_number === lastRound)[0];
      if (lastChoice) {
        setFinalOptionId(lastChoice.chosen_option_id);
        const path: { round: number; text: string }[] = [];
        choiceList
          .sort((a, b) => a.round_number - b.round_number || a.match_index - b.match_index)
          .forEach((c) => {
            const opt = map[c.chosen_option_id];
            path.push({ round: c.round_number, text: opt?.text?.trim() || (opt?.image_url ? (lang === 'ko' ? '이미지' : 'Image') : c.chosen_option_id) });
          });
        setPathSummary(path);
      }
      const { data: playsInGame } = await supabase.from('balance_game_plays').select('id').eq('game_id', gameId);
      const playIds = (playsInGame || []).map((p) => p.id);
      if (playIds.length > 0) {
        const { data: agg } = await supabase
          .from('balance_game_choices')
          .select('chosen_option_id')
          .in('play_id', playIds)
          .eq('round_number', totalRounds);
        const stats: Record<string, number> = {};
        (agg || []).forEach((row: { chosen_option_id: string }) => {
          stats[row.chosen_option_id] = (stats[row.chosen_option_id] || 0) + 1;
        });
        setGlobalStats(stats);
      }
      setLoading(false);
      return;
    }

    const { data: choiceRows } = await supabase
      .from('balance_game_choices')
      .select('round_number, match_index, chosen_option_id')
      .eq('play_id', play.id)
      .order('round_number')
      .order('match_index');
    setChoices((choiceRows || []) as ChoiceRow[]);
    if (play.completed_at) {
      if (user) {
        const { data: likeRow } = await supabase
          .from('balance_game_likes')
          .select('id')
          .eq('game_id', gameId)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsLiked(!!likeRow);
      }
      const { data: commentRows } = await supabase
        .from('balance_game_comments')
        .select('id, content, user_id, created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (commentRows?.length) {
        const userIds = [...new Set(commentRows.map((c: { user_id: string }) => c.user_id))];
        const { data: usersData } = await supabase.from('users').select('id, nickname').in('id', userIds);
        const { data: gameUsersData } = await supabase.from('game_users').select('auth_user_id, nickname').in('auth_user_id', userIds);
        const usersMap = new Map((usersData || []).map((u: { id: string; nickname: string }) => [u.id, u.nickname]));
        const gameUsersMap = new Map((gameUsersData || []).map((gu: { auth_user_id: string; nickname: string }) => [gu.auth_user_id, gu.nickname]));
        setComments(
          commentRows.map((c: { id: string; content: string; user_id: string; created_at: string }) => ({
            id: c.id,
            content: c.content,
            user_nickname: gameUsersMap.get(c.user_id) || usersMap.get(c.user_id) || 'User',
            created_at: c.created_at,
          }))
        );
      }
    }
    setLoading(false);
  }, [gameId, user, totalRounds, forceNewPlay, lang]);

  const loadResultStats = useCallback(async () => {
    if (!gameId) return;
    const supabase = createClient();
    const { data: game } = await supabase.from('balance_games').select('view_count, like_count').eq('id', gameId).single();
    if (game) {
      setViewCount(game.view_count ?? 0);
      setLikeCount(game.like_count ?? 0);
    }
    if (user) {
      const { data: likeRow } = await supabase
        .from('balance_game_likes')
        .select('id')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsLiked(!!likeRow);
    }
    const { data: commentRows } = await supabase
      .from('balance_game_comments')
      .select('id, content, user_id, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (commentRows?.length) {
      const userIds = [...new Set(commentRows.map((c: { user_id: string }) => c.user_id))];
      const { data: usersData } = await supabase.from('users').select('id, nickname').in('id', userIds);
      const { data: gameUsersData } = await supabase.from('game_users').select('auth_user_id, nickname').in('auth_user_id', userIds);
      const usersMap = new Map((usersData || []).map((u: { id: string; nickname: string }) => [u.id, u.nickname]));
      const gameUsersMap = new Map((gameUsersData || []).map((gu: { auth_user_id: string; nickname: string }) => [gu.auth_user_id, gu.nickname]));
      setComments(
        commentRows.map((c: { id: string; content: string; user_id: string; created_at: string }) => ({
          id: c.id,
          content: c.content,
          user_nickname: gameUsersMap.get(c.user_id) || usersMap.get(c.user_id) || 'User',
          created_at: c.created_at,
        }))
      );
    } else {
      setComments([]);
    }
  }, [gameId, user]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!gameId || loading || viewCountUpdatedRef.current === gameId || !forceNewPlay) return;
    const run = async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('increment_balance_game_view_count', { game_id: gameId });
      if (!error) {
        viewCountUpdatedRef.current = gameId;
        setViewCount((v) => v + 1);
      }
    };
    run();
  }, [gameId, loading, forceNewPlay]);

  const currentRound = (() => {
    if (choices.length === 0) return 1;
    const maxRound = Math.max(...choices.map((c) => c.round_number));
    const matchesInMax = getMatchesForRound(maxRound, shuffledIds, choices, tournamentSize);
    const choicesInMax = choices.filter((c) => c.round_number === maxRound).length;
    if (choicesInMax >= matchesInMax.length) return maxRound + 1;
    return maxRound;
  })();

  const currentMatchIndex = (() => {
    const choicesInCurrent = choices.filter((c) => c.round_number === currentRound).length;
    return choicesInCurrent;
  })();

  const currentMatches = getMatchesForRound(currentRound, shuffledIds, choices, tournamentSize);
  const isFinal = currentRound === totalRounds && currentMatches.length === 1;
  const currentMatch = currentMatches[currentMatchIndex];
  const showResult = completed || (isFinal && currentMatch && choices.some((c) => c.round_number === totalRounds && c.match_index === 0));

  const handleChoose = async (chosenOptionId: string) => {
    if (!playId || !currentMatch || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('balance_game_choices').insert({
      play_id: playId,
      round_number: currentRound,
      match_index: currentMatchIndex,
      chosen_option_id: chosenOptionId,
    });
    if (error) {
      setSaving(false);
      return;
    }
    setChoices((prev) => [...prev, { round_number: currentRound, match_index: currentMatchIndex, chosen_option_id: chosenOptionId }]);

    if (isFinal) {
      await supabase.from('balance_game_plays').update({ completed_at: new Date().toISOString() }).eq('id', playId);
      setCompleted(true);
      setFinalOptionId(chosenOptionId);
      const newChoices = [...choices, { round_number: currentRound, match_index: currentMatchIndex, chosen_option_id: chosenOptionId }];
      const path: { round: number; text: string }[] = [];
      newChoices
        .sort((a, b) => a.round_number - b.round_number || a.match_index - b.match_index)
        .forEach((c) => {
          const opt = optionsMap[c.chosen_option_id];
          path.push({ round: c.round_number, text: opt?.text?.trim() || (opt?.image_url ? (lang === 'ko' ? '이미지' : 'Image') : c.chosen_option_id) });
        });
      setPathSummary(path);
      const { data: playsInGame } = await supabase.from('balance_game_plays').select('id').eq('game_id', gameId);
      const playIds = (playsInGame || []).map((p) => p.id);
      if (playIds.length > 0) {
        const { data: agg } = await supabase
          .from('balance_game_choices')
          .select('chosen_option_id')
          .in('play_id', playIds)
          .eq('round_number', totalRounds);
        const stats: Record<string, number> = {};
        (agg || []).forEach((row: { chosen_option_id: string }) => {
          stats[row.chosen_option_id] = (stats[row.chosen_option_id] || 0) + 1;
        });
        setGlobalStats(stats);
      }
      loadResultStats();
    }
    setSaving(false);
  };

  const handleLikeToggle = async () => {
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return;
    }
    const supabase = createClient();
    if (isLiked) {
      await supabase.from('balance_game_likes').delete().eq('game_id', gameId).eq('user_id', user.id);
      setIsLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('balance_game_likes').insert({ game_id: gameId, user_id: user.id });
      setIsLiked(true);
      setLikeCount((c) => c + 1);
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !newComment.trim()) {
      if (!user) router.push(`/${lang}/auth/login`);
      return;
    }
    setIsSubmittingComment(true);
    const supabase = createClient();
    const { error } = await supabase.from('balance_game_comments').insert({
      game_id: gameId,
      user_id: user.id,
      content: newComment.trim(),
    });
    if (!error) {
      setNewComment('');
      loadResultStats();
    }
    setIsSubmittingComment(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center safe-area-padding">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400" />
      </div>
    );
  }

  const isIntro = !forceNewPlay && title && playId === null;
  if (isIntro) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-6 sm:pb-8">
        <div className="container mx-auto px-4 py-4 sm:py-6 max-w-2xl">
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <Link href={`/${lang}/balance`} className="text-slate-400 hover:text-white text-sm py-2 -ml-1 min-h-[44px] flex items-center">
              <i className="ri-arrow-left-line mr-2" />
              {lang === 'ko' ? '목록' : 'List'}
            </Link>
            {user && createdBy === user.id && (
              <Link
                href={`/${lang}/balance/${gameId}/edit`}
                className="text-amber-400 hover:text-amber-300 text-sm font-medium py-2 px-3 min-h-[44px] flex items-center rounded-lg"
              >
                <i className="ri-edit-line mr-1" />
                {lang === 'ko' ? '수정' : 'Edit'}
              </Link>
            )}
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800/80 mb-3 sm:mb-4 aspect-video max-h-[35vh] sm:max-h-[38vh]">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <i className="ri-scales-line text-4xl sm:text-5xl text-slate-600" />
              </div>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white mb-1">{title}</h1>
          <p className="text-slate-400 text-xs sm:text-sm mb-3">
            {tournamentSize}{lang === 'ko' ? '강' : ''} {lang === 'ko' ? '토너먼트' : 'tournament'}
          </p>
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm text-slate-400 mb-4">
            <span className="flex items-center gap-1"><i className="ri-eye-line" /> {viewCount}</span>
            <span className="flex items-center gap-1"><i className="ri-heart-line" /> {likeCount}</span>
            <span className="flex items-center gap-1"><i className="ri-chat-3-line" /> {comments.length}</span>
          </div>
          <Link
            href={`/${lang}/balance/${gameId}?new=1`}
            className="w-full py-3.5 sm:py-4 text-center bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-xl font-semibold text-base sm:text-lg transition-colors min-h-[48px] sm:min-h-[52px] flex items-center justify-center mb-4"
          >
            {lang === 'ko' ? '새 판 하기' : 'Start game'}
          </Link>
          <div className="bg-slate-800/80 rounded-xl p-3 sm:p-4 border border-slate-700 max-h-40 sm:max-h-48 overflow-y-auto">
            <p className="text-slate-400 text-xs mb-2">{lang === 'ko' ? '댓글' : 'Comments'}</p>
            {comments.length === 0 ? (
              <p className="text-slate-500 text-sm">{lang === 'ko' ? '댓글이 없습니다.' : 'No comments yet.'}</p>
            ) : (
              <ul className="space-y-2">
                {comments.slice(0, 5).map((c) => (
                  <li key={c.id} className="text-sm">
                    <span className="text-slate-400 font-medium">{c.user_nickname}</span>
                    <span className="text-slate-500 ml-2 text-xs">{new Date(c.created_at).toLocaleDateString()}</span>
                    <p className="text-slate-300 mt-0.5 break-words">{c.content}</p>
                  </li>
                ))}
                {comments.length > 5 && (
                  <li className="text-slate-500 text-xs">{lang === 'ko' ? `외 ${comments.length - 5}개` : `+${comments.length - 5} more`}</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (completed || showResult) {
    const totalVotes = Object.values(globalStats).reduce((a, b) => a + b, 0);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white pb-6 sm:pb-8">
        <div className="container mx-auto px-4 py-4 sm:py-6 max-w-2xl">
          <Link href={`/${lang}/balance`} className="text-slate-400 hover:text-white text-sm mb-4 min-h-[44px] flex items-center w-fit">
            <i className="ri-arrow-left-line mr-2" />
            {lang === 'ko' ? '목록' : 'List'}
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">{title}</h1>
          <div className="bg-slate-800/80 rounded-xl p-4 sm:p-6 border border-slate-700 mb-4">
            <p className="text-slate-400 text-xs sm:text-sm mb-2">{lang === 'ko' ? '최종 선택' : 'Your final choice'}</p>
            {finalOptionId && optionsMap[finalOptionId]?.image_url ? (
              <div className="rounded-lg overflow-hidden border border-slate-600 bg-slate-900">
                <img src={optionsMap[finalOptionId].image_url!} alt="" className="w-full max-h-56 sm:max-h-64 object-contain" />
                {optionsMap[finalOptionId].text?.trim() && <p className="text-base sm:text-lg font-semibold text-white p-3 sm:p-4">{optionsMap[finalOptionId].text}</p>}
              </div>
            ) : (
              <p className="text-base sm:text-lg font-semibold text-white">{finalOptionId ? (optionsMap[finalOptionId]?.text?.trim() || finalOptionId) : '-'}</p>
            )}
          </div>
          {pathSummary.length > 0 && (
            <div className="bg-slate-800/80 rounded-xl p-4 sm:p-6 border border-slate-700 mb-4">
              <p className="text-slate-400 text-xs sm:text-sm mb-2">{lang === 'ko' ? '결승까지 경로' : 'Path to final'}</p>
              <ul className="space-y-1 text-xs sm:text-sm text-slate-300">
                {pathSummary.map((p, i) => (
                  <li key={i}>{getRoundLabel(p.round, tournamentSize, totalRounds, lang)}: {p.text}</li>
                ))}
              </ul>
            </div>
          )}
          {totalVotes > 0 && (
            <div className="bg-slate-800/80 rounded-xl p-4 sm:p-6 border border-slate-700 mb-4">
              <p className="text-slate-400 text-xs sm:text-sm mb-2">{lang === 'ko' ? '다른 플레이어 선택 비율' : 'Other players\' choices'}</p>
              <ul className="space-y-2 text-xs sm:text-sm">
                {Object.entries(globalStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([optId, count]) => {
                    const opt = optionsMap[optId];
                    const label = opt?.text?.trim() || (opt?.image_url ? (lang === 'ko' ? '이미지' : 'Image') : optId);
                    return (
                      <li key={optId} className="flex items-center justify-between gap-2 text-slate-300">
                        {opt?.image_url && (
                          <span className="shrink-0 w-10 h-10 rounded overflow-hidden bg-slate-800">
                            <img src={opt.image_url} alt="" className="w-full h-full object-cover" />
                          </span>
                        )}
                        <span className="truncate flex-1 min-w-0">{label}</span>
                        <span className="text-slate-400 shrink-0">{Math.round((count / totalVotes) * 100)}%</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          )}
          <div className="bg-slate-800/80 rounded-xl p-3 sm:p-4 border border-slate-700 mb-4 flex items-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm">
            <span className="text-slate-400 flex items-center gap-1">
              <i className="ri-eye-line" /> {viewCount}
            </span>
            <button
              type="button"
              onClick={handleLikeToggle}
              className="flex items-center gap-1 min-h-[44px]"
            >
              <i className={isLiked ? 'ri-heart-fill text-red-400' : 'ri-heart-line text-slate-400'} />
              <span className="text-slate-300">{likeCount}</span>
            </button>
            <span className="text-slate-400 flex items-center gap-1">
              <i className="ri-chat-3-line" /> {comments.length}
            </span>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-3 sm:p-4 border border-slate-700 mb-4">
            <p className="text-slate-400 text-xs sm:text-sm mb-2">{lang === 'ko' ? '댓글' : 'Comments'}</p>
            <ul className="space-y-2 mb-3 max-h-44 sm:max-h-48 overflow-y-auto text-xs sm:text-sm">
              {comments.length === 0 ? (
                <li className="text-slate-500">{lang === 'ko' ? '댓글이 없습니다.' : 'No comments yet.'}</li>
              ) : (
                comments.map((c) => (
                  <li key={c.id}>
                    <span className="text-slate-400 font-medium">{c.user_nickname}</span>
                    <span className="text-slate-500 ml-2 text-xs">{new Date(c.created_at).toLocaleDateString()}</span>
                    <p className="text-slate-300 mt-0.5 break-words">{c.content}</p>
                  </li>
                ))
              )}
            </ul>
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={lang === 'ko' ? '댓글 입력...' : 'Write a comment...'}
                className="flex-1 rounded-lg bg-slate-900 border border-slate-600 px-3 py-2.5 text-sm text-white placeholder-slate-500 min-h-[44px]"
              />
              <button
                type="button"
                onClick={handleSubmitComment}
                disabled={isSubmittingComment || !newComment.trim()}
                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 rounded-lg text-sm font-medium min-h-[44px]"
              >
                {lang === 'ko' ? '등록' : 'Post'}
              </button>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3">
            <Link href={`/${lang}/balance/${gameId}?new=1`} className="inline-flex items-center justify-center py-2.5 sm:py-3 px-4 sm:px-5 bg-amber-500 hover:bg-amber-600 rounded-lg text-sm sm:text-base font-medium min-h-[44px]">
              {lang === 'ko' ? '새 판 하기' : 'New game'}
            </Link>
            <Link href={`/${lang}/balance`} className="inline-flex items-center justify-center py-2.5 sm:py-3 px-4 sm:px-5 bg-teal-500 hover:bg-teal-600 rounded-lg text-sm sm:text-base font-medium min-h-[44px]">
              {lang === 'ko' ? '다른 게임 하기' : 'Play another'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!currentMatch) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
          <Link href={`/${lang}/balance`} className="mt-4 inline-block text-teal-400 text-sm">{lang === 'ko' ? '목록으로' : 'Back to list'}</Link>
        </div>
      </div>
    );
  }

  const [optAId, optBId] = currentMatch;
  const optA = optionsMap[optAId];
  const optB = optionsMap[optBId];

  const renderOption = (opt: OptionRecord | undefined, id: string) => {
    if (!opt) return <span className="break-words">{id}</span>;
    const hasImage = !!opt.image_url?.trim();
    const hasText = !!opt.text?.trim();
    return (
      <>
        {/* 그림 영역: 반응형으로 크게, 한 화면에 글씨까지 보이게 */}
        <span className="w-full flex-shrink-0 h-[42vh] min-h-[180px] sm:h-[44vh] sm:min-h-[200px] md:h-[46vh] md:min-h-[220px] max-h-[340px] sm:max-h-[400px] flex items-center justify-center overflow-hidden bg-slate-900">
          {hasImage ? (
            <img src={opt.image_url!} alt="" className="w-full h-full object-cover" />
          ) : hasText ? (
            <span className="text-white text-base sm:text-lg font-medium text-center px-3 break-words line-clamp-5">{opt.text}</span>
          ) : (
            <span className="text-slate-500 text-sm sm:text-base">{lang === 'ko' ? '이미지 없음' : 'No image'}</span>
          )}
        </span>
        {/* 그 아래 텍스트: 글자 키움 + 반응형 */}
        <span className="w-full flex-shrink-0 py-2.5 px-2 sm:py-3 sm:px-3 text-center text-base sm:text-lg md:text-xl text-white font-medium break-words min-h-[3rem] sm:min-h-[3.5rem] flex items-center justify-center">
          {hasImage && hasText ? opt.text : hasImage ? '' : (hasText ? opt.text : id)}
        </span>
      </>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      <div className="flex flex-col flex-1 min-h-0 max-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 px-3 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2">
          <div className="flex items-center justify-between gap-2 min-h-[40px] sm:min-h-[44px]">
            <Link href={`/${lang}/balance/${gameId}`} className="text-slate-400 hover:text-white text-xs sm:text-sm py-2 -ml-1 flex items-center min-w-[72px] sm:min-w-[80px]">
              <i className="ri-arrow-left-line mr-1.5 sm:mr-2" />
              {lang === 'ko' ? '나가기' : 'Exit'}
            </Link>
            <span className="text-slate-400 text-xs sm:text-sm font-medium">
              {getRoundLabel(currentRound, tournamentSize, totalRounds, lang)}
            </span>
            <Link
              href={`/${lang}/balance/${gameId}?new=1`}
              className="text-amber-400 hover:text-amber-300 text-xs sm:text-sm font-medium py-2 pr-1 min-w-[72px] sm:min-w-[80px] text-right"
            >
              {lang === 'ko' ? '새 판' : 'New'}
            </Link>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-white mt-0.5 sm:mt-1 truncate">{title}</h1>
        </div>

        <div
          key={`${currentRound}-${currentMatchIndex}`}
          className="flex-1 min-h-0 grid grid-cols-2 gap-px bg-slate-700 overflow-auto balance-round-enter"
        >
          <button
            type="button"
            onClick={() => handleChoose(optAId)}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-0 text-white font-medium disabled:opacity-50 transition-colors flex flex-col items-stretch min-w-0 min-h-[140px] touch-manipulation select-none"
          >
            {renderOption(optA, optAId)}
          </button>
          <button
            type="button"
            onClick={() => handleChoose(optBId)}
            disabled={saving}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-0 text-white font-medium disabled:opacity-50 transition-colors flex flex-col items-stretch min-w-0 min-h-[140px] touch-manipulation select-none"
          >
            {renderOption(optB, optBId)}
          </button>
        </div>
      </div>
    </div>
  );
}
