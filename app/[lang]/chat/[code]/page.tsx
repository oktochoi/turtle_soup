'use client';

import { use } from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

type ChatMessage = {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
};

type RoomMember = {
  id: string;
  nickname: string;
  joined_at: string;
  user_id?: string;
};

export default function ChatRoomPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const roomCode = resolvedParams.code;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [roomName, setRoomName] = useState('');
  const [nickname, setNickname] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomPassword, setRoomPassword] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/auth/login`);
    }
  }, [authLoading, user, lang, router]);

  // 스크롤 처리
  const scrollToBottom = () => {
    // 입력 필드에 포커스가 있으면 자동 스크롤하지 않음
    if (document.activeElement === messageInputRef.current) {
      return;
    }
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const isNearBottom = scrollHeight - currentScrollTop - clientHeight < 100;

      if (currentScrollTop < lastScrollTop.current) {
        setIsUserScrolling(true);
      } else if (isNearBottom) {
        setIsUserScrolling(false);
      }

      lastScrollTop.current = currentScrollTop;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isUserScrolling]);

  // 방 로드 및 참가
  useEffect(() => {
    if (!user || !roomCode) return;

    const loadRoom = async () => {
      try {
        const supabase = createClient();

        // 방 정보 로드
        const { data: room, error: roomError } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('code', roomCode)
          .single();

        if (roomError || !room) {
          setError(lang === 'ko' ? '방을 찾을 수 없습니다.' : 'Room not found.');
          setIsLoading(false);
          return;
        }

        setRoomName(room.name);
        setRoomPassword(room.password);
        setHostUserId(room.host_user_id || null);

        // 비밀번호가 있으면 입력 요청
        if (room.password) {
          setShowPasswordModal(true);
          setIsLoading(false);
          return;
        }

        // 사용자 닉네임 가져오기
        const { data: userData } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', user.id)
          .maybeSingle();

        const userNickname = userData?.nickname || user.email?.split('@')[0] || 'User';
        setNickname(userNickname);

        // 멤버 확인 및 추가 (upsert 사용하여 중복 방지)
        const { data: existingMember } = await supabase
          .from('chat_room_members')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existingMember) {
          // 멤버 추가 (중복 키 오류는 무시)
          const { error: memberError } = await supabase
            .from('chat_room_members')
            .insert({
              room_id: room.id,
              user_id: user.id,
              nickname: userNickname,
            });

          // UNIQUE 제약 조건 위반은 무시 (이미 멤버인 경우)
          if (memberError && !memberError.message?.includes('duplicate key') && !memberError.message?.includes('unique constraint')) {
            throw memberError;
          }
        } else {
          setNickname(existingMember.nickname);
        }

        // 멤버 목록 로드
        loadMembers(room.id);

        // 메시지 로드
        loadMessages(room.id);

        // Realtime 구독
        const chatChannel = supabase
          .channel(`chat-room:${room.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_room_messages',
              filter: `room_id=eq.${room.id}`,
            },
            (payload) => {
              const newMessage = payload.new as any;
              setMessages((prev) => {
                const exists = prev.some((m) => m.id === newMessage.id);
                if (exists) return prev;
                return [
                  ...prev,
                  {
                    id: newMessage.id,
                    nickname: newMessage.nickname,
                    message: newMessage.message,
                    timestamp: new Date(newMessage.created_at).getTime(),
                  },
                ].sort((a, b) => a.timestamp - b.timestamp);
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'chat_room_members',
              filter: `room_id=eq.${room.id}`,
            },
            () => {
              // 멤버 목록 새로고침
              loadMembers(room.id);
            }
          )
          .subscribe();

        setIsLoading(false);

        return () => {
          chatChannel.unsubscribe();
        };
      } catch (err: any) {
        console.error('방 로드 오류:', err);
        setError(err.message || (lang === 'ko' ? '방을 불러오는데 실패했습니다.' : 'Failed to load room.'));
        setIsLoading(false);
      }
    };

    loadRoom();
  }, [user, roomCode, lang]);

  const loadMessages = async (roomId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('chat_room_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      if (data) {
        setMessages(
          data.map((msg) => ({
            id: msg.id,
            nickname: msg.nickname,
            message: msg.message,
            timestamp: new Date(msg.created_at).getTime(),
          }))
        );
      }
    } catch (err: any) {
      console.error('메시지 로드 오류:', err);
    }
  };

  const loadMembers = async (roomId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('chat_room_members')
        .select('*')
        .eq('room_id', roomId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      if (data) {
        setMembers(
          data.map((m: any) => ({
            id: m.id,
            nickname: m.nickname,
            joined_at: m.joined_at,
            user_id: m.user_id,
          }))
        );
      }
    } catch (err: any) {
      console.error('멤버 로드 오류:', err);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!enteredPassword.trim()) return;

    if (enteredPassword !== roomPassword) {
      alert(lang === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Password incorrect.');
      return;
    }

    setShowPasswordModal(false);
    setIsJoining(true);

    // 방 다시 로드
    try {
      const supabase = createClient();
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('*')
        .eq('code', roomCode)
        .single();

      if (room) {
        const { data: userData } = await supabase
          .from('users')
          .select('nickname')
          .eq('id', user?.id)
          .maybeSingle();

        const userNickname = userData?.nickname || user?.email?.split('@')[0] || 'User';
        setNickname(userNickname);

        // 멤버 확인 후 추가 (중복 키 오류는 무시)
        const { data: existingMember } = await supabase
          .from('chat_room_members')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', user?.id)
          .maybeSingle();

        if (!existingMember) {
          const { error: memberError } = await supabase
            .from('chat_room_members')
            .insert({
              room_id: room.id,
              user_id: user?.id,
              nickname: userNickname,
            });

          // UNIQUE 제약 조건 위반은 무시 (이미 멤버인 경우)
          if (memberError && !memberError.message?.includes('duplicate key') && !memberError.message?.includes('unique constraint')) {
            throw memberError;
          }
        } else {
          setNickname(existingMember.nickname);
        }

        loadMembers(room.id);
        loadMessages(room.id);
      }
    } catch (err: any) {
      console.error('참가 오류:', err);
      alert(lang === 'ko' ? '방 참가에 실패했습니다.' : 'Failed to join room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !nickname || !user) return;

    const messageToSend = messageText.trim();
    setMessageText('');

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      nickname,
      message: messageToSend,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp));

    try {
      const supabase = createClient();
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('code', roomCode)
        .single();

      if (!room) throw new Error('Room not found');

      const { data, error } = await supabase
        .from('chat_room_messages')
        .insert({
          room_id: room.id,
          user_id: user.id,
          nickname,
          message: messageToSend,
        })
        .select()
        .single();

      if (error) throw error;

      // 실제 메시지로 교체
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return [
          ...withoutTemp,
          {
            id: data.id,
            nickname: data.nickname,
            message: data.message,
            timestamp: new Date(data.created_at).getTime(),
          },
        ].sort((a, b) => a.timestamp - b.timestamp);
      });
    } catch (err: any) {
      console.error('메시지 전송 오류:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(lang === 'ko' ? '메시지 전송에 실패했습니다.' : 'Failed to send message.');
      setMessageText(messageToSend);
    }
  };

  const handleCopyRoomCode = async () => {
    try {
      const roomUrl = `${window.location.origin}/${lang}/chat/${roomCode}`;
      await navigator.clipboard.writeText(roomUrl);
      alert(lang === 'ko' ? '방 링크가 복사되었습니다.' : 'Room link copied.');
    } catch (err) {
      alert(lang === 'ko' ? '복사에 실패했습니다.' : 'Failed to copy.');
    }
  };

  const handleLeaveRoom = async () => {
    if (!user || !confirm(lang === 'ko' ? '정말 나가시겠습니까?' : 'Are you sure you want to leave?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('id')
        .eq('code', roomCode)
        .single();

      if (room) {
        // 멤버 삭제 (트리거가 자동으로 퇴장 메시지 생성)
        await supabase
          .from('chat_room_members')
          .delete()
          .eq('room_id', room.id)
          .eq('user_id', user.id);
      }

      router.push(`/${lang}`);
    } catch (err: any) {
      console.error('나가기 오류:', err);
      alert(lang === 'ko' ? '나가기에 실패했습니다.' : 'Failed to leave room.');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href={`/${lang}`}>
            <button className="text-teal-400 hover:text-teal-300">
              {lang === 'ko' ? '메인으로' : 'Go Home'}
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* 헤더 */}
      <div className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-teal-400">{roomName}</h1>
            <p className="text-xs text-slate-400">
              {lang === 'ko' ? `${members.length}명 참가중` : `${members.length} members`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyRoomCode}
              className="px-3 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 rounded-lg transition-colors text-sm flex items-center gap-1"
              title={lang === 'ko' ? '방 링크 복사' : 'Copy room link'}
            >
              <i className="ri-link text-base"></i>
              {lang === 'ko' ? '링크 복사' : 'Copy Link'}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
            >
              {lang === 'ko' ? '나가기' : 'Leave'}
            </button>
            <Link href={`/${lang}`}>
              <button className="text-slate-400 hover:text-white transition-colors">
                <i className="ri-home-line text-xl"></i>
              </button>
            </Link>
            <button
              onClick={() => router.back()}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 container mx-auto max-w-6xl p-4 flex gap-4">
        {/* 참가자 목록 */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 sticky top-4">
            <h3 className="text-sm font-semibold mb-3 text-teal-400 flex items-center gap-2">
              <i className="ri-group-line"></i>
              {lang === 'ko' ? '참가자' : 'Participants'} ({members.length})
            </h3>
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
              {members.map((member) => {
                const isHost = user && hostUserId === user.id && member.user_id === user.id;
                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      isHost
                        ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30'
                        : 'bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isHost && (
                        <i className="ri-vip-crown-line text-yellow-400"></i>
                      )}
                      <span className={`text-sm ${
                        isHost ? 'text-teal-400 font-semibold' : 'text-slate-300'
                      }`}>
                        {member.nickname}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 채팅 메시지 영역 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3 mb-4"
          >
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">{lang === 'ko' ? '아직 메시지가 없습니다.' : 'No messages yet.'}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.nickname === nickname;
              const isSystem = msg.nickname === 'SYSTEM';
              
              // 시스템 메시지 스타일
              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    className="flex justify-center my-2"
                  >
                    <div className="bg-slate-700/50 text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-600/50">
                      {msg.message}
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-xs font-semibold ${isOwn ? 'text-cyan-400' : 'text-teal-400'}`}>
                      {msg.nickname}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${
                      isOwn
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-700 text-slate-200 border border-slate-600'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 메시지 입력 */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            ref={messageInputRef}
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={lang === 'ko' ? '메시지 입력...' : 'Type a message...'}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-send-plane-line"></i>
          </button>
        </form>
        </div>
      </div>

      {/* 비밀번호 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">{lang === 'ko' ? '비밀번호 입력' : 'Enter Password'}</h2>
            <input
              type="password"
              value={enteredPassword}
              onChange={(e) => setEnteredPassword(e.target.value)}
              placeholder={lang === 'ko' ? '방 비밀번호' : 'Room password'}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handlePasswordSubmit}
                disabled={isJoining || !enteredPassword.trim()}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {lang === 'ko' ? '입장' : 'Join'}
              </button>
              <button
                onClick={() => router.back()}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-4 py-2"
              >
                {lang === 'ko' ? '취소' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

