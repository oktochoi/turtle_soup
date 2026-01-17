'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { RoomCardSkeleton } from '@/components/Skeleton';
import { RoomsEmptyState } from '@/components/EmptyState';
import { handleError } from '@/lib/error-handler';

type Room = {
  code: string;
  story: string;
  host_nickname: string;
  password: string | null;
  max_questions: number;
  created_at: string;
  game_ended?: boolean;
  status?: string;
  quiz_type?: string;
  room_name?: string;
  theme?: string;
  level?: string;
  max_players?: number;
  player_count: number;
  last_activity_at?: string | null;
  last_chat_at?: string | null;
};

export default function RoomsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [minPlayers, setMinPlayers] = useState<number>(0);
  const [sortOption, setSortOption] = useState<'latest' | 'oldest' | 'most_players' | 'recent_activity'>('latest');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [error, setError] = useState<string>('');
  
  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredRooms.length / itemsPerPage);
  const paginatedRooms = filteredRooms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    loadRooms();
    
    // 실시간으로 방 리스트 업데이트
    const subscription = supabase
      .channel('rooms_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
        },
        () => {
          loadRooms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
        },
        () => {
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lang]);

  const loadRooms = async () => {
    try {
      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      
      let query = supabase
        .from('rooms')
        .select('code, story, host_nickname, password, max_questions, created_at, game_ended, status, quiz_type, room_name, theme, level, max_players, lang, last_activity_at')
        .in('status', ['active', 'done', 'LOBBY', 'PLAYING', 'FINISHED']);
      
      // lang 컬럼으로 필터링 시도
      const result = await query.eq('lang', currentLang).order('created_at', { ascending: false });
      
      // lang 컬럼이 없어서 에러가 발생한 경우
      if (result.error && (result.error.code === '42703' || result.error.message?.includes('column') || result.error.message?.includes('lang'))) {
        console.warn('lang 컬럼이 없습니다. 모든 방을 가져옵니다. 마이그레이션을 실행해주세요.');
        // lang 컬럼 없이 모든 방 가져오기
        const allResult = await supabase
          .from('rooms')
          .select('code, story, host_nickname, password, max_questions, created_at, game_ended, status, quiz_type, room_name, theme, level, max_players, last_activity_at')
          .in('status', ['active', 'done', 'LOBBY', 'PLAYING', 'FINISHED'])
          .order('created_at', { ascending: false });
        
        if (allResult.error) throw allResult.error;
        
        // 클라이언트 사이드에서 필터링 (lang 필드가 있는 경우만)
        const filteredData = (allResult.data || []).filter((r: any) => !r.lang || r.lang === currentLang);
        
        // 각 방의 플레이어 수와 최근 대화 시간 가져오기
        const roomsWithPlayerCount = await Promise.all(
          filteredData.map(async (room) => {
            const { count } = await supabase
              .from('players')
              .select('*', { count: 'exact', head: true })
              .eq('room_code', room.code);

            // 최근 대화 시간 가져오기
            const { data: lastChat } = await supabase
              .from('room_chats')
              .select('created_at')
              .eq('room_code', room.code)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...room,
              player_count: count || 0,
              last_chat_at: lastChat?.created_at || null,
            };
          })
        );

        setRooms(roomsWithPlayerCount);
        setFilteredRooms(roomsWithPlayerCount);
        return;
      }
      
      if (result.error) throw result.error;
      
      const roomsData = result.data;

      // 각 방의 플레이어 수와 최근 대화 시간 가져오기
      const roomsWithPlayerCount = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('room_code', room.code);

          // 최근 대화 시간 가져오기
          const { data: lastChat } = await supabase
            .from('room_chats')
            .select('created_at')
            .eq('room_code', room.code)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...room,
            player_count: count || 0,
            last_chat_at: lastChat?.created_at || null,
          };
        })
      );

      setRooms(roomsWithPlayerCount);
      setFilteredRooms(roomsWithPlayerCount);
    } catch (error: any) {
      // AbortError는 무해한 에러이므로 무시 (컴포넌트 언마운트 시 발생 가능)
      if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
        console.error('방 리스트 로드 오류:', error);
        setError(t.room.loadRoomListFail);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 및 필터링
  useEffect(() => {
    let filtered = [...rooms];
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(room => 
        room.code.toLowerCase().includes(query) ||
        room.story.toLowerCase().includes(query) ||
        room.host_nickname.toLowerCase().includes(query)
      );
    }

    // 공개/비공개 필터
    if (privacyFilter === 'public') {
      filtered = filtered.filter(room => !room.password);
    } else if (privacyFilter === 'private') {
      filtered = filtered.filter(room => !!room.password);
    }

    // 최소 인원수 필터
    if (minPlayers > 0) {
      filtered = filtered.filter(room => room.player_count >= minPlayers);
    }

    // 정렬
    switch (sortOption) {
      case 'latest':
        filtered.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'oldest':
        filtered.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case 'most_players':
        filtered.sort((a, b) => b.player_count - a.player_count);
        break;
      case 'recent_activity':
        filtered.sort((a, b) => {
          const aTime = a.last_chat_at ? new Date(a.last_chat_at).getTime() : new Date(a.created_at).getTime();
          const bTime = b.last_chat_at ? new Date(b.last_chat_at).getTime() : new Date(b.created_at).getTime();
          return bTime - aTime;
        });
        break;
    }

    setFilteredRooms(filtered);
  }, [searchQuery, privacyFilter, minPlayers, sortOption, rooms]);

  const handleJoinRoom = (roomCode: string, hasPassword: boolean, quizType?: string) => {
    if (hasPassword) {
      setSelectedRoom(roomCode);
      setShowPasswordModal(true);
    } else {
      // 게임 타입에 따라 다른 경로로 이동
      const roomPath = quizType === 'liar' 
        ? `/${lang}/liar_room/${roomCode}`
        : quizType === 'mafia'
        ? `/${lang}/mafia_room/${roomCode}`
        : `/${lang}/turtle_room/${roomCode}`;
      router.push(roomPath);
    }
  };

  const handleSubmitPassword = () => {
    if (!selectedRoom) return;
    if (!password.trim()) {
      setError(t.room.enterPasswordAlert);
      return;
    }
    
    setError('');
    // 선택된 방의 게임 타입 확인
    const selectedRoomData = rooms.find(r => r.code === selectedRoom);
    const quizType = selectedRoomData?.quiz_type;
    
    // 게임 타입에 따라 다른 경로로 이동
    const roomPath = quizType === 'liar' 
      ? `/${lang}/liar_room/${selectedRoom}`
      : quizType === 'mafia'
      ? `/${lang}/mafia_room/${selectedRoom}`
      : `/${lang}/turtle_room/${selectedRoom}`;
    
    const urlParams = new URLSearchParams({
      password: password.trim(),
    });
    router.push(`${roomPath}?${urlParams.toString()}`);
    setShowPasswordModal(false);
    setPassword('');
  };

  // 로딩 상태는 아래에서 처리

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
          <button
            onClick={loadRooms}
            className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm"
          >
            <i className="ri-refresh-line mr-2"></i>
            {t.room.refresh}
          </button>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                {t.room.roomList}
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">{t.room.selectRoomToJoin}</p>
            </div>
            <Link href={`/${lang}/create-room`}>
              <button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-teal-500/50 text-sm sm:text-base whitespace-nowrap">
                <i className="ri-add-circle-line mr-2"></i>
                {t.room.createNewRoom}
              </button>
            </Link>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="mb-4">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder={t.room.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <i className="ri-close-line"></i>
              </button>
            )}
          </div>
        </div>

        {/* 필터 */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 공개/비공개 필터 */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">{t.room.privacy}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrivacyFilter('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {t.room.all}
              </button>
              <button
                onClick={() => setPrivacyFilter('public')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'public'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                <i className="ri-global-line mr-1"></i>
                {t.room.public}
              </button>
              <button
                onClick={() => setPrivacyFilter('private')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'private'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                <i className="ri-lock-line mr-1"></i>
                {t.room.private}
              </button>
            </div>
          </div>

          {/* 최소 인원수 필터 */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">{t.room.minPlayers}</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="100"
                value={minPlayers}
                onChange={(e) => setMinPlayers(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="0"
              />
              <button
                onClick={() => setMinPlayers(0)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  minPlayers === 0
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
                disabled={minPlayers === 0}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>

          {/* 정렬 */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">{lang === 'ko' ? '정렬' : 'Sort'}</label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="latest">{lang === 'ko' ? '최신순' : 'Latest'}</option>
              <option value="oldest">{lang === 'ko' ? '오래된순' : 'Oldest'}</option>
              <option value="most_players">{lang === 'ko' ? '인원 많은순' : 'Most Players'}</option>
              <option value="recent_activity">{lang === 'ko' ? '최근 활동순' : 'Recent Activity'}</option>
            </select>
          </div>
        </div>

        {/* 필터 초기화 */}
        <div className="mb-4">
          <button
            onClick={() => {
              setSearchQuery('');
              setPrivacyFilter('all');
              setMinPlayers(0);
              setSortOption('latest');
            }}
            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-all"
          >
            <i className="ri-refresh-line mr-2"></i>
            {t.room.resetFilters}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* 필터 결과 개수 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            {filteredRooms.length > 0 ? (
              <>
                {lang === 'ko' 
                  ? <>총 <span className="font-semibold text-teal-400">{filteredRooms.length}</span>개의 방{rooms.length !== filteredRooms.length && <span className="text-slate-500 ml-2">(전체 {rooms.length}개 중)</span>}</>
                  : <><span className="font-semibold text-teal-400">{filteredRooms.length}</span> rooms{rooms.length !== filteredRooms.length && <span className="text-slate-500 ml-2">(of {rooms.length} total)</span>}</>
                }
              </>
            ) : (
              <span>{t.room.noResults}</span>
            )}
          </p>
          {(searchQuery || privacyFilter !== 'all' || minPlayers > 0) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPrivacyFilter('all');
                setMinPlayers(0);
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <i className="ri-filter-off-line"></i>
              {t.room.clearFilters}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <RoomsEmptyState 
            lang={lang}
            hasSearchQuery={!!searchQuery}
            onClearSearch={() => {
              setSearchQuery('');
              setPrivacyFilter('all');
              setMinPlayers(0);
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedRooms.map((room) => (
              <div
                key={room.code}
                className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700 hover:border-teal-500/50 transition-all"
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-teal-400">{room.code}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 게임 타입 배지 */}
                      {room.quiz_type && (
                        <span className={`px-2 py-1 rounded text-xs border font-semibold ${
                          room.quiz_type === 'liar' 
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                            : room.quiz_type === 'mafia'
                            ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                            : 'bg-teal-500/20 text-teal-400 border-teal-500/50'
                        }`}>
                          {room.quiz_type === 'liar' 
                            ? (lang === 'ko' ? '라이어 게임' : 'Liar Game')
                            : room.quiz_type === 'mafia'
                            ? (lang === 'ko' ? '마피아' : 'Mafia')
                            : (lang === 'ko' ? '바다거북스프' : 'Turtle Soup')
                          }
                        </span>
                      )}
                      {(room.game_ended || room.status === 'done' || room.status === 'FINISHED') && (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/50">
                          <i className="ri-stop-circle-line mr-1"></i>
                          {t.room.ended}
                        </span>
                      )}
                      {room.password ? (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/50">
                          <i className="ri-lock-line mr-1"></i>
                          {t.room.password}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/50">
                          <i className="ri-global-line mr-1"></i>
                          {t.room.public}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 라이어 게임인 경우 room_name 표시, 그 외에는 story 표시 */}
                  {room.quiz_type === 'liar' ? (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-200 mb-1">{room.room_name || (lang === 'ko' ? '라이어 게임 방' : 'Liar Game Room')}</p>
                      {room.theme && (
                        <p className="text-xs text-slate-400">
                          {lang === 'ko' ? '주제' : 'Theme'}: {room.theme} | {lang === 'ko' ? '난이도' : 'Difficulty'}: {room.level}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300 line-clamp-2 mb-3">{room.story}</p>
                  )}
                  <div className="flex flex-col gap-2 text-xs text-slate-400 mb-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span>
                        <i className="ri-user-line mr-1"></i>
                        {t.room.host}: {room.host_nickname}
                      </span>
                      <span>
                        <i className="ri-group-line mr-1"></i>
                        {room.player_count}{room.quiz_type === 'liar' && room.max_players ? ` / ${room.max_players}` : ''}{lang === 'ko' ? t.room.playersCount : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-slate-700/50">
                      {room.created_at && (
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line text-teal-400"></i>
                          <span className="text-slate-300">
                            {lang === 'ko' ? '생성' : 'Created'}: {new Date(room.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </span>
                      )}
                      {room.last_chat_at ? (
                        <span className="flex items-center gap-1">
                          <i className="ri-chat-3-line text-cyan-400"></i>
                          <span className="text-slate-300">
                            {lang === 'ko' ? '최근 대화' : 'Last Chat'}: {new Date(room.last_chat_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <i className="ri-chat-3-line text-slate-500"></i>
                          <span className="text-slate-500">
                            {lang === 'ko' ? '아직 대화가 없습니다' : 'No chat yet'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!(room.game_ended || room.status === 'done' || room.status === 'FINISHED') && (
                    <button
                      onClick={() => handleJoinRoom(room.code, !!room.password, room.quiz_type)}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                    >
                      <i className="ri-login-box-line mr-2"></i>
                      {t.room.join}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const spectatorPath = room.quiz_type === 'liar' 
                        ? `/${lang}/liar_room/${room.code}?spectator=true`
                        : room.quiz_type === 'mafia'
                        ? `/${lang}/mafia_room/${room.code}?spectator=true`
                        : `/${lang}/turtle_room/${room.code}?spectator=true`;
                      router.push(spectatorPath);
                    }}
                    className={`${!(room.game_ended || room.status === 'done' || room.status === 'FINISHED') ? 'flex-1' : 'w-full'} bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all text-sm border border-slate-600`}
                    title={t.room.spectateModeTooltip}
                  >
                    <i className="ri-eye-line mr-2"></i>
                    {t.room.spectator}
                  </button>
                </div>
              </div>
            ))}
            </div>

            {/* 광고: 방 리스트 중간 (5개 방 후) */}
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
                >
                  <i className="ri-arrow-left-line"></i>
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 sm:px-4 py-2 rounded-lg transition-all text-sm font-semibold ${
                        currentPage === pageNum
                          ? 'bg-teal-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
                >
                  <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold mb-4 text-white">{t.room.enterRoomPassword}</h3>
            <input
              type="password"
              placeholder={t.room.enterPasswordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitPassword();
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleSubmitPassword}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                {t.common.confirm}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

