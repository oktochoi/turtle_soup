'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Room = {
  code: string;
  story: string;
  host_nickname: string;
  password: string | null;
  max_questions: number;
  created_at: string;
  player_count: number;
};

export default function RoomsPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'private'>('all');
  const [minPlayers, setMinPlayers] = useState<number>(0);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [error, setError] = useState<string>('');

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
          filter: 'status=eq.active',
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
  }, []);

  const loadRooms = async () => {
    try {
      // active 상태인 방들 가져오기
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('code, story, host_nickname, password, max_questions, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (roomsError) throw roomsError;

      // 각 방의 플레이어 수 가져오기
      const roomsWithPlayerCount = await Promise.all(
        (roomsData || []).map(async (room) => {
          const { count } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('room_code', room.code);

          return {
            ...room,
            player_count: count || 0,
          };
        })
      );

      setRooms(roomsWithPlayerCount);
      setFilteredRooms(roomsWithPlayerCount);
    } catch (error: any) {
      // AbortError는 무해한 에러이므로 무시 (컴포넌트 언마운트 시 발생 가능)
      if (error?.name !== 'AbortError' && error?.message?.includes('aborted') === false) {
        console.error('방 리스트 로드 오류:', error);
        setError('방 리스트를 불러올 수 없습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 및 필터링
  useEffect(() => {
    let filtered = [...rooms];

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

    setFilteredRooms(filtered);
  }, [searchQuery, privacyFilter, minPlayers, rooms]);

  const handleJoinRoom = (roomCode: string, hasPassword: boolean) => {
    if (hasPassword) {
      setSelectedRoom(roomCode);
      setShowPasswordModal(true);
    } else {
      // 비밀번호가 없으면 바로 방으로 이동 (닉네임은 room 페이지에서 입력받음)
      router.push(`/room/${roomCode}`);
    }
  };

  const handleSubmitPassword = () => {
    if (!selectedRoom) return;
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    
    setError('');
    // 비밀번호를 URL에 포함하여 방으로 이동 (닉네임은 room 페이지에서 입력받음)
    const urlParams = new URLSearchParams({
      password: password.trim(),
    });
    router.push(`/room/${selectedRoom}?${urlParams.toString()}`);
    setShowPasswordModal(false);
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-6 relative w-24 h-24 mx-auto">
            <svg 
              className="w-full h-full animate-turtle-float"
              viewBox="0 0 100 100" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <ellipse cx="50" cy="55" rx="30" ry="20" fill="#14b8a6" />
              <ellipse cx="50" cy="50" rx="25" ry="18" fill="#0d9488" />
              <path d="M 50 35 Q 45 40 50 45 Q 55 40 50 35" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              <path d="M 35 50 Q 40 45 45 50 Q 40 55 35 50" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              <path d="M 65 50 Q 60 45 55 50 Q 60 55 65 50" stroke="#0f766e" strokeWidth="1.5" fill="none" />
              <ellipse cx="50" cy="30" rx="8" ry="10" fill="#14b8a6" />
              <circle cx="47" cy="28" r="1.5" fill="white" />
              <circle cx="53" cy="28" r="1.5" fill="white" />
              <ellipse cx="35" cy="60" rx="5" ry="8" fill="#14b8a6" />
              <ellipse cx="65" cy="60" rx="5" ry="8" fill="#14b8a6" />
              <ellipse cx="30" cy="70" rx="6" ry="5" fill="#14b8a6" />
              <ellipse cx="70" cy="70" rx="6" ry="5" fill="#14b8a6" />
            </svg>
          </div>
          <p className="text-slate-400">방 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        <div className="mb-4 sm:mb-6 flex items-center justify-between">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
            </button>
          </Link>
          <button
            onClick={loadRooms}
            className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm"
          >
            <i className="ri-refresh-line mr-2"></i>
            새로고침
          </button>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                방 목록
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">참여 가능한 방을 선택하세요</p>
            </div>
            <Link href="/create-room">
              <button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-teal-500/50 text-sm sm:text-base whitespace-nowrap">
                <i className="ri-add-circle-line mr-2"></i>
                새 방 생성하기
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
              placeholder="방 코드, 스토리, 호스트명으로 검색..."
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
            <label className="block text-xs text-slate-400 mb-2">공개 설정</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPrivacyFilter('all')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  privacyFilter === 'all'
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                전체
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
                공개
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
                비공개
              </button>
            </div>
          </div>

          {/* 최소 인원수 필터 */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">최소 인원수</label>
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

          {/* 필터 초기화 */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setPrivacyFilter('all');
                setMinPlayers(0);
              }}
              className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg transition-all"
            >
              <i className="ri-refresh-line mr-2"></i>
              필터 초기화
            </button>
          </div>
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
                총 <span className="font-semibold text-teal-400">{filteredRooms.length}</span>개의 방
                {rooms.length !== filteredRooms.length && (
                  <span className="text-slate-500 ml-2">
                    (전체 {rooms.length}개 중)
                  </span>
                )}
              </>
            ) : (
              <span>검색 결과가 없습니다</span>
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
              필터 해제
            </button>
          )}
        </div>

        {filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <i className="ri-door-open-line text-6xl text-slate-600"></i>
            </div>
            {searchQuery ? (
              <>
                <p className="text-slate-400 mb-4">검색 결과가 없습니다.</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition-all"
                >
                  검색 초기화
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-400 mb-4">현재 참여 가능한 방이 없습니다.</p>
                <Link href="/create-room">
                  <button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-6 py-3 rounded-xl transition-all">
                    새 방 만들기
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRooms.map((room) => (
              <div
                key={room.code}
                className="bg-slate-800/50 rounded-xl p-4 sm:p-5 border border-slate-700 hover:border-teal-500/50 transition-all"
              >
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold text-teal-400">{room.code}</span>
                    {room.password ? (
                      <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs border border-yellow-500/50">
                        <i className="ri-lock-line mr-1"></i>
                        비밀번호
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/50">
                        <i className="ri-global-line mr-1"></i>
                        공개
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 line-clamp-2 mb-3">{room.story}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>
                      <i className="ri-user-line mr-1"></i>
                      호스트: {room.host_nickname}
                    </span>
                    <span>
                      <i className="ri-group-line mr-1"></i>
                      {room.player_count}명
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleJoinRoom(room.code, !!room.password)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold py-2.5 rounded-lg transition-all text-sm"
                >
                  <i className="ri-login-box-line mr-2"></i>
                  참여하기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 비밀번호 입력 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold mb-4 text-white">방 비밀번호 입력</h3>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
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
                확인
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                  setError('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

