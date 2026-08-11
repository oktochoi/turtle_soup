'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/hooks/useTranslations';
import { RoomCardSkeleton } from '@/components/Skeleton';
import { RoomsEmptyState } from '@/components/EmptyState';

type Room = {
  code: string;
  story: string;
  host_nickname: string;
  password: string | null;
  max_questions: number;
  created_at: string;
  game_ended?: boolean;
  status?: string;
  quiz_type?: string | null;
  player_count: number;
  last_activity_at?: string | null;
  last_chat_at?: string | null;
};

function isSoupRoom(quizType: string | null | undefined): boolean {
  return quizType == null || quizType === 'soup';
}

export default function RoomsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
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

  const enrichRoomsWithPlayerCount = async (roomsData: any[]): Promise<Room[]> => {
    const soupRooms = roomsData.filter((room) => isSoupRoom(room.quiz_type));

    return Promise.all(
      soupRooms.map(async (room) => {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('room_code', room.code);

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
  };

  const loadRooms = async () => {
    try {
      const currentLang = 'ko';
      const selectFields = 'code, story, host_nickname, password, max_questions, created_at, game_ended, status, quiz_type, last_activity_at';
      const statusFilter = ['active', 'done', 'LOBBY', 'PLAYING', 'FINISHED'] as const;
      
      let result = await supabase
        .from('rooms')
        .select(`${selectFields}, lang`)
        .in('status', [...statusFilter])
        .eq('lang', currentLang)
        .order('created_at', { ascending: false });
      
      // lang 컬럼이 없어서 에러가 발생한 경우
      if (result.error && (result.error.code === '42703' || result.error.message?.includes('column') || result.error.message?.includes('lang'))) {
        console.warn('lang 컬럼이 없습니다. 모든 방을 가져옵니다. 마이그레이션을 실행해주세요.');
        const allResult = await supabase
          .from('rooms')
          .select(selectFields)
          .in('status', [...statusFilter])
          .order('created_at', { ascending: false });
        
        if (allResult.error) throw allResult.error;
        
        const filteredData = (allResult.data || []).filter((r: any) => !r.lang || r.lang === currentLang);
        const roomsWithPlayerCount = await enrichRoomsWithPlayerCount(filteredData);
        
        setRooms(roomsWithPlayerCount);
        setFilteredRooms(roomsWithPlayerCount);
        return;
      }
      
      if (result.error) throw result.error;
      
      const roomsWithPlayerCount = await enrichRoomsWithPlayerCount(result.data || []);
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

  const turtleRoomPath = (roomCode: string, query?: Record<string, string>) => {
    const base = `/${lang}/turtle_room/${roomCode}`;
    if (!query || Object.keys(query).length === 0) return base;
    return `${base}?${new URLSearchParams(query).toString()}`;
  };

  const handleJoinRoom = async (roomCode: string, hasPassword: boolean) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      alert('멀티플레이 방에 입장하려면 로그인이 필요합니다.');
      router.push(`/${lang}/auth/login?redirect=/${lang}/rooms`);
      return;
    }
    
    if (hasPassword) {
      setSelectedRoom(roomCode);
      setShowPasswordModal(true);
    } else {
      router.push(turtleRoomPath(roomCode));
    }
  };

  const handleSubmitPassword = async () => {
    if (!selectedRoom) return;
    if (!password.trim()) {
      setError(t.room.enterPasswordAlert);
      return;
    }
    
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      alert('멀티플레이 방에 입장하려면 로그인이 필요합니다.');
      router.push(`/${lang}/auth/login?redirect=/${lang}/rooms`);
      setShowPasswordModal(false);
      setPassword('');
      return;
    }
    
    setError('');
    router.push(turtleRoomPath(selectedRoom, { password: password.trim() }));
    setShowPasswordModal(false);
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-800 via-ink-700 to-ink-800 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <Link href={`/${lang}`}>
            <button className="text-fog hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
          <button
            onClick={loadRooms}
            className="text-fog hover:text-white transition-colors text-xs sm:text-sm"
          >
            <i className="ri-refresh-line mr-2"></i>
            {t.room.refresh}
          </button>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-brass-300 to-brass bg-clip-text text-transparent">
                {t.room.roomList}
              </h1>
              <p className="text-fog text-xs sm:text-sm">{t.room.selectRoomToJoin}</p>
            </div>
            <Link href={`/${lang}/create-room`}>
              <button className="bg-gradient-to-r from-brass to-brass-600 hover:from-brass-600 hover:to-brass-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-teal-500/50 text-sm sm:text-base whitespace-nowrap">
                <i className="ri-add-circle-line mr-2"></i>
                {t.room.createNewRoom}
              </button>
            </Link>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="mb-4">
          <div className="relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-fog"></i>
            <input
              type="text"
              placeholder={t.room.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink-700 border border-brass/20 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-fog hover:text-white transition-colors"
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
            <label className="block text-xs text-fog mb-2">{t.room.privacy}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrivacyFilter('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'all'
                    ? 'bg-brass text-white'
                    : 'bg-ink-700 text-fog hover:bg-ink-600 border border-brass/20'
                }`}
              >
                {t.room.all}
              </button>
              <button
                onClick={() => setPrivacyFilter('public')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'public'
                    ? 'bg-green-500 text-white'
                    : 'bg-ink-700 text-fog hover:bg-ink-600 border border-brass/20'
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
                    : 'bg-ink-700 text-fog hover:bg-ink-600 border border-brass/20'
                }`}
              >
                <i className="ri-lock-line mr-1"></i>
                {t.room.private}
              </button>
            </div>
          </div>

          {/* 최소 인원수 필터 */}
          <div>
            <label className="block text-xs text-fog mb-2">{t.room.minPlayers}</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="100"
                value={minPlayers}
                onChange={(e) => setMinPlayers(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 bg-ink-700 border border-brass/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="0"
              />
              <button
                onClick={() => setMinPlayers(0)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  minPlayers === 0
                    ? 'bg-ink-600 text-fog'
                    : 'bg-ink-700 text-fog hover:bg-ink-600 border border-brass/20'
                }`}
                disabled={minPlayers === 0}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>

          {/* 정렬 */}
          <div>
            <label className="block text-xs text-fog mb-2">{'정렬'}</label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
              className="w-full bg-ink-700 border border-brass/20 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="latest">{'최신순'}</option>
              <option value="oldest">{'오래된순'}</option>
              <option value="most_players">{'인원 많은순'}</option>
              <option value="recent_activity">{'최근 활동순'}</option>
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
            className="w-full px-4 py-2 bg-ink-600 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-all"
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
          <p className="text-sm text-fog">
            {filteredRooms.length > 0 ? (
              <>
                <>총 <span className="font-semibold text-brass">{filteredRooms.length}</span>개의 방{rooms.length !== filteredRooms.length && <span className="text-fog-dim ml-2">(전체 {rooms.length}개 중)</span>}</>
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
              className="text-xs text-fog hover:text-white transition-colors flex items-center gap-1"
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
                className="bg-ink-700/50 rounded-xl p-4 sm:p-5 border border-brass/20 hover:border-brass/50 transition-all"
              >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-brass">{room.code}</span>
                      <div className="flex items-center gap-2 flex-wrap">
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
                  <p className="text-sm text-fog line-clamp-2 mb-3">{room.story}</p>
                  <div className="flex flex-col gap-2 text-xs text-fog mb-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span>
                        <i className="ri-user-line mr-1"></i>
                        {t.room.host}: {room.host_nickname}
                      </span>
                      <span>
                        <i className="ri-group-line mr-1"></i>
                        {room.player_count}{t.room.playersCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-brass/20">
                      {room.created_at && (
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line text-brass"></i>
                          <span className="text-fog">
                            {'생성'}: {new Date(room.created_at).toLocaleString('ko-KR', {
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
                          <i className="ri-chat-3-line text-brass"></i>
                          <span className="text-fog">
                            {'최근 대화'}: {new Date(room.last_chat_at).toLocaleString('ko-KR', {
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
                          <i className="ri-chat-3-line text-fog-dim"></i>
                          <span className="text-fog-dim">
                            {'아직 대화가 없습니다'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!(room.game_ended || room.status === 'done' || room.status === 'FINISHED') && (
                    <button
                      onClick={() => handleJoinRoom(room.code, !!room.password)}
                      className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                    >
                      <i className="ri-login-box-line mr-2"></i>
                      {t.room.join}
                    </button>
                  )}
                  <button
                    onClick={() => router.push(turtleRoomPath(room.code, { spectator: 'true' }))}
                    className={`${!(room.game_ended || room.status === 'done' || room.status === 'FINISHED') ? 'flex-1' : 'w-full'} bg-ink-600 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all text-sm border border-brass/25`}
                    title={t.room.spectateModeTooltip}
                  >
                    <i className="ri-eye-line mr-2"></i>
                    {t.room.spectator}
                  </button>
                </div>
              </div>
            ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 bg-ink-700 hover:bg-ink-600 disabled:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
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
                          ? 'bg-brass text-white'
                          : 'bg-ink-700 hover:bg-ink-600 text-fog'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 bg-ink-700 hover:bg-ink-600 disabled:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all text-sm font-semibold"
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
          <div className="bg-ink-700 rounded-xl p-6 max-w-md w-full border border-brass/20">
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
              className="w-full bg-ink-800 border border-brass/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleSubmitPassword}
                className="flex-1 bg-gradient-to-r from-brass to-brass-600 hover:from-brass-600 hover:to-brass-700 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                {t.common.confirm}
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError('');
                }}
                className="flex-1 bg-ink-600 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all"
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
