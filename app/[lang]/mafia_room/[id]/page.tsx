'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import ChatPanel from '../../room/[code]/ChatPanel';

export default function MafiaRoomPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const roomCode = resolvedParams.id;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState<'LOBBY' | 'PLAYING' | 'FINISHED'>('LOBBY');
  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [players, setPlayers] = useState<Array<{ nickname: string; is_host: boolean; is_ready?: boolean }>>([]);
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomCreatedAt, setRoomCreatedAt] = useState<Date | null>(null);
  const [lastChatAt, setLastChatAt] = useState<Date | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); // 관리자 여부

  // 로그인 필수: 로그인 유저 닉네임 자동 사용
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
      return;
    }

    const loadUserNickname = async () => {
      try {
        // 관리자 권한 확인
        const { data: gameUser } = await supabase
          .from('game_users')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();
        
        setIsAdmin(gameUser?.is_admin || false);

        // rooms 테이블에서 호스트 확인
        const { data: roomData } = await supabase
          .from('rooms')
          .select('host_nickname, host_user_id')
          .eq('code', roomCode)
          .single();
        
        // users 테이블에서 닉네임 가져오기
        const { createClient } = await import('@/lib/supabase/client');
        const supabaseClient = createClient();
        const { data: userData } = await supabaseClient
          .from('users')
          .select('nickname')
          .eq('id', user.id)
          .maybeSingle();

        const userNickname = roomData?.host_user_id === user.id
          ? (roomData.host_nickname || userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'))
          : (userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'));

        if (roomData?.host_user_id === user.id) {
          setIsHost(true);
          setNickname(userNickname);
          await joinRoom(userNickname, true);
        } else {
          setIsHost(false);
          setNickname(userNickname);
          await joinRoom(userNickname, false);
        }
      } catch (err) {
        console.error('닉네임 로드 오류:', err);
        alert(lang === 'ko' ? '닉네임을 불러오지 못했습니다.' : 'Failed to load nickname.');
        router.push(`/${lang}`);
      }
    };

    loadUserNickname();
  }, [user, authLoading, roomCode, lang, router]);

  // 방 참여 함수
  const joinRoom = async (playerNickname: string, isHostPlayer: boolean) => {
    try {
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: playerNickname,
          is_host: isHostPlayer,
        });

      if (playerError && playerError.code !== '23505') {
        console.error('플레이어 추가 오류:', playerError);
      } else {
        // localStorage에 닉네임 저장
        localStorage.setItem(`nickname_${roomCode}`, playerNickname);
      }
    } catch (err) {
      console.error('방 참여 오류:', err);
    }
  };

  // 방 정보 로드
  useEffect(() => {
    const loadRoom = async () => {
      if (!isSupabaseConfigured()) {
        setError(lang === 'ko' ? 'Supabase가 설정되지 않았습니다.' : 'Supabase is not configured.');
        setIsLoading(false);
        return;
      }

      try {
        const { data: room, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .single();

        if (roomError) {
          if (roomError.code === 'PGRST116' || roomError.message?.includes('No rows')) {
            setError(lang === 'ko' ? '방을 찾을 수 없습니다.' : 'Room not found.');
            setIsLoading(false);
            return;
          } else {
            throw roomError;
          }
        }

        if (room) {
          setStory(room.story || '');
          setTruth(room.truth || '');
          setGameStatus((room.status as 'LOBBY' | 'PLAYING' | 'FINISHED') || 'LOBBY');
          setRoomCreatedAt(room.created_at ? new Date(room.created_at) : null);
        }
      } catch (err) {
        console.error('방 로드 오류:', err);
        setError(lang === 'ko' ? '방을 불러오는데 실패했습니다.' : 'Failed to load room.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRoom();
  }, [roomCode, lang]);

  // 참가자 목록 로드 및 실시간 구독
  useEffect(() => {
    if (!roomCode) return;

    const loadPlayers = async () => {
      const { data: playersData } = await supabase
        .from('players')
        .select('nickname, is_host')
        .eq('room_code', roomCode);
      
      if (playersData) {
        setPlayers(playersData.map(p => ({
          nickname: p.nickname,
          is_host: p.is_host,
          is_ready: false,
        })));
      }
    };

    loadPlayers();

    const playersChannel = supabase
      .channel(`players:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_code=eq.${roomCode}`,
        },
        async () => {
          const { data: playersData } = await supabase
            .from('players')
            .select('nickname, is_host')
            .eq('room_code', roomCode);
          
          if (playersData) {
            setPlayers(playersData.map(p => ({
              nickname: p.nickname,
              is_host: p.is_host,
              is_ready: false,
            })));
          }
        }
      )
      .subscribe();

    return () => {
      playersChannel.unsubscribe();
    };
  }, [roomCode]);

  // 채팅 시간 업데이트
  useEffect(() => {
    if (!roomCode) return;

    const chatTimeChannel = supabase
      .channel(`chat-time:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chats',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          if (payload.new && payload.new.created_at) {
            setLastChatAt(new Date(payload.new.created_at));
          }
        }
      )
      .subscribe();

    supabase
      .from('room_chats')
      .select('created_at')
      .eq('room_code', roomCode)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.created_at) {
          setLastChatAt(new Date(data.created_at));
        }
      });

    return () => {
      chatTimeChannel.unsubscribe();
    };
  }, [roomCode]);

  // 관리자 방 삭제 함수
  const handleDeleteRoom = async () => {
    if (!isAdmin) return;
    
    if (!confirm(lang === 'ko' ? '정말 이 방을 삭제하시겠습니까? 모든 참가자가 나가게 됩니다.' : 'Are you sure you want to delete this room? All participants will be removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('code', roomCode);

      if (error) throw error;

      alert(lang === 'ko' ? '방이 삭제되었습니다.' : 'Room deleted successfully.');
      router.push(`/${lang}/rooms`);
    } catch (err: any) {
      console.error('방 삭제 오류:', err);
      alert(lang === 'ko' ? '방 삭제에 실패했습니다.' : 'Failed to delete room.');
    }
  };

  const handleLeaveRoom = async () => {
    if (!nickname) return;

    const confirmMessage = isHost 
      ? (lang === 'ko' ? '호스트로 나가시면 방이 종료됩니다. 정말 나가시겠습니까?' : 'Leaving as host will end the room. Are you sure?')
      : (lang === 'ko' ? '방에서 나가시겠습니까?' : 'Are you sure you want to leave the room?');
    
    if (!confirm(confirmMessage)) return;

    try {
      // 1. players 테이블에서 플레이어 정보 삭제
      const { error: deleteError } = await supabase
        .from('players')
        .delete()
        .eq('room_code', roomCode)
        .eq('nickname', nickname);

      if (deleteError) {
        console.error('플레이어 삭제 오류:', deleteError);
        throw deleteError;
      }

      // 2. 호스트인 경우 방 종료
      if (isHost) {
        await supabase
          .from('rooms')
          .update({ status: 'FINISHED', game_ended: true })
          .eq('code', roomCode);
      }

      // 3. localStorage에서 닉네임 및 관련 정보 삭제
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`nickname_${roomCode}`);
        localStorage.removeItem(`roomCode_${roomCode}`);
      }

      // 4. 방 목록으로 리다이렉트
      router.push(`/${lang}/rooms`);
    } catch (error) {
      console.error('방 나가기 오류:', error);
      alert(lang === 'ko' ? '방 나가기에 실패했습니다.' : 'Failed to leave room.');
    }
  };

  const handleStartGame = async () => {
    if (!isHost || players.length < 3) {
      alert(lang === 'ko' ? '최소 3명 이상 모여야 게임을 시작할 수 있습니다.' : 'At least 3 players are required to start the game.');
      return;
    }

    try {
      await supabase
        .from('rooms')
        .update({ status: 'PLAYING' })
        .eq('code', roomCode);
      
      setGameStatus('PLAYING');
    } catch (error) {
      console.error('게임 시작 오류:', error);
      alert(lang === 'ko' ? '게임 시작에 실패했습니다.' : 'Failed to start game.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{lang === 'ko' ? '로딩 중...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
        <div className="bg-slate-800 rounded-2xl p-8 max-w-md w-full border border-slate-700 shadow-2xl text-center">
          <i className="ri-error-warning-line text-5xl text-red-400 mb-4"></i>
          <h2 className="text-2xl font-bold mb-2 text-white">{error}</h2>
          <button
            onClick={() => router.push(`/${lang}`)}
            className="mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            {t.common.backToHome}
          </button>
        </div>
      </div>
    );
  }

  // Navy Ink + Purple 색상 테마
  const bgColor = '#070A12';
  const surfaceColor = '#0D1220';
  const borderColor = '#1C2541';
  const textPrimary = '#E6EAF2';
  const textSecondary = '#98A2B3';
  const accentColor = '#A78BFA';
  const accentHover = '#60A5FA';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textPrimary }}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/${lang}`}>
            <button className="transition-colors text-sm sm:text-base" style={{ color: textSecondary }}>
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLeaveRoom}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-all text-xs sm:text-sm font-semibold flex items-center gap-1.5"
            >
              <i className="ri-logout-box-line"></i>
              <span className="hidden sm:inline">{lang === 'ko' ? '나가기' : 'Leave'}</span>
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              gameStatus === 'FINISHED' ? 'bg-red-500/20 text-red-400' : 
              gameStatus === 'PLAYING' ? 'bg-green-500/20 text-green-400' : 
              'bg-yellow-500/20 text-yellow-400'
            }`}>
              {gameStatus === 'FINISHED' ? (lang === 'ko' ? '종료' : 'Finished') :
               gameStatus === 'PLAYING' ? (lang === 'ko' ? '진행중' : 'Playing') :
               (lang === 'ko' ? '대기중' : 'Lobby')}
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
          <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: accentColor }}>
            {lang === 'ko' ? '마피아 게임 방' : 'Mafia Game Room'}
          </h1>
        </div>

        {gameStatus === 'LOBBY' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
              <p className="text-sm" style={{ color: textSecondary }}>
                {lang === 'ko' ? '최소 3명 이상 모이면 시작할 수 있습니다.' : 'At least 3 players are required to start.'}
              </p>
            </div>

            <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                <i className="ri-group-line mr-2"></i>
                {lang === 'ko' ? '참가자' : 'Players'} ({players.length})
              </h3>
              <div className="space-y-2">
                {players.map((player, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      player.is_host ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30' : 'bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {player.is_host && <i className="ri-vip-crown-line text-yellow-400"></i>}
                      <span className={`text-sm ${player.is_host ? 'text-purple-400 font-semibold' : 'text-slate-300'}`}>
                        {player.nickname}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={players.length < 3}
                className="w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: players.length < 3 ? `${accentColor}50` : `linear-gradient(to right, ${accentColor}, ${accentHover})`,
                  color: bgColor,
                }}
              >
                <i className="ri-play-line mr-2"></i>
                {lang === 'ko' ? '게임 시작' : 'Start Game'}
              </button>
            )}

            {nickname && <ChatPanel roomCode={roomCode} nickname={nickname} lang={lang} />}
          </div>
        )}

        {gameStatus === 'PLAYING' && (
          <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
            <p className="text-center text-sm" style={{ color: textSecondary }}>
              {lang === 'ko' ? '게임 진행 중...' : 'Game in progress...'}
            </p>
          </div>
        )}

        {gameStatus === 'FINISHED' && (
          <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
            <p className="text-center text-sm" style={{ color: textSecondary }}>
              {lang === 'ko' ? '게임이 종료되었습니다.' : 'Game finished.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

