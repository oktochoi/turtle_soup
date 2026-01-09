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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
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
          const { data: playersData } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('room_code', room.code);

          return {
            ...room,
            player_count: playersData?.length || 0,
          };
        })
      );

      setRooms(roomsWithPlayerCount);
    } catch (error) {
      console.error('방 리스트 로드 오류:', error);
      setError('방 리스트를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = (roomCode: string, hasPassword: boolean) => {
    if (!nickname.trim()) {
      setShowNicknameModal(true);
      setSelectedRoom(roomCode);
      return;
    }

    if (hasPassword) {
      setSelectedRoom(roomCode);
      setShowPasswordModal(true);
    } else {
      joinRoom(roomCode, '');
    }
  };

  const joinRoom = async (roomCode: string, enteredPassword: string) => {
    try {
      // 방 정보 가져오기
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('code, password')
        .eq('code', roomCode)
        .single();

      if (roomError) throw roomError;

      // 비밀번호 체크
      if (room.password && room.password !== enteredPassword) {
        setError('비밀번호가 올바르지 않습니다.');
        return;
      }

      // 닉네임이 없으면 입력받기
      if (!nickname.trim()) {
        setShowNicknameModal(true);
        return;
      }

      // 방 참여
      const { error: joinError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: nickname.trim(),
          is_host: false,
        });

      if (joinError) {
        // 이미 참여한 경우나 다른 에러
        if (joinError.code === '23505') {
          // 이미 참여한 경우
          router.push(`/room/${roomCode}?nickname=${encodeURIComponent(nickname.trim())}`);
          return;
        }
        throw joinError;
      }

      // localStorage에 닉네임 저장
      localStorage.setItem(`nickname_${roomCode}`, nickname.trim());
      localStorage.setItem(`roomCode_${roomCode}`, roomCode);

      // 방으로 이동
      router.push(`/room/${roomCode}?nickname=${encodeURIComponent(nickname.trim())}`);
    } catch (error) {
      console.error('방 참여 오류:', error);
      setError('방 참여에 실패했습니다.');
    }
  };

  const handleSubmitPassword = () => {
    if (!selectedRoom) return;
    setError('');
    joinRoom(selectedRoom, password);
    setShowPasswordModal(false);
    setPassword('');
  };

  const handleSubmitNickname = () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    setShowNicknameModal(false);
    setError('');
    
    if (selectedRoom) {
      // 비밀번호가 필요한 방인지 확인
      const room = rooms.find(r => r.code === selectedRoom);
      if (room?.password) {
        setShowPasswordModal(true);
      } else {
        joinRoom(selectedRoom, '');
      }
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            방 목록
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">참여 가능한 방을 선택하세요</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <i className="ri-door-open-line text-6xl text-slate-600"></i>
            </div>
            <p className="text-slate-400 mb-4">현재 참여 가능한 방이 없습니다.</p>
            <Link href="/create-room">
              <button className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold px-6 py-3 rounded-xl transition-all">
                새 방 만들기
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => (
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

      {/* 닉네임 입력 모달 */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-lg font-bold mb-4 text-white">닉네임 입력</h3>
            <input
              type="text"
              placeholder="닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmitNickname();
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
              maxLength={20}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleSubmitNickname}
                className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2.5 rounded-lg transition-all"
              >
                확인
              </button>
              <button
                onClick={() => {
                  setShowNicknameModal(false);
                  setNickname('');
                  setSelectedRoom(null);
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

