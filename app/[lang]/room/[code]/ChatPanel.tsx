'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/hooks/useTranslations';

type ChatMessage = {
  id: string;
  nickname: string;
  message: string;
  timestamp: number;
};

interface ChatPanelProps {
  roomCode: string;
  nickname: string;
  lang: string;
  title?: string; // 커스텀 제목 (선택적)
  gamePhase?: 'LOBBY' | 'ROLE_REVEAL' | 'SPEAKING' | 'VOTING' | 'RESULT'; // 게임 단계
}

export default function ChatPanel({ roomCode, nickname, lang, title, gamePhase }: ChatPanelProps) {
  const t = useTranslations();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const lastScrollTop = useRef(0);

  // 스크롤을 맨 아래로 (사용자가 스크롤을 올리지 않았을 때만)
  const scrollToBottom = () => {
    // 입력 필드에 포커스가 있으면 자동 스크롤하지 않음
    if (document.activeElement === messageInputRef.current) {
      return;
    }
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 스크롤 이벤트 감지
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const isNearBottom = scrollHeight - currentScrollTop - clientHeight < 100; // 하단 100px 이내

      // 사용자가 위로 스크롤했는지 확인
      if (currentScrollTop < lastScrollTop.current) {
        setIsUserScrolling(true);
      } else if (isNearBottom) {
        // 다시 하단 근처로 왔으면 자동 스크롤 재개
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

  // 실시간 채팅 구독
  useEffect(() => {
    if (!roomCode) return;

    const chatChannel = supabase
      .channel(`chat:${roomCode}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chats',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('💬 새 채팅 메시지 (Realtime):', payload.new);
          const newMessage = payload.new as any;
          setMessages(prev => {
            // 중복 체크 (실제 ID와 임시 ID 모두 체크)
            const exists = prev.some(m => 
              m.id === newMessage.id || 
              (m.id.startsWith('temp-chat-') && 
               m.nickname === newMessage.nickname && 
               m.message === newMessage.message &&
               Math.abs(m.timestamp - new Date(newMessage.created_at).getTime()) < 5000) // 5초 이내면 같은 메시지로 간주
            );
            if (exists) {
              // 임시 메시지가 있으면 실제 메시지로 교체
              const tempIndex = prev.findIndex(m => 
                m.id.startsWith('temp-chat-') && 
                m.nickname === newMessage.nickname && 
                m.message === newMessage.message
              );
              if (tempIndex !== -1) {
                const updated = [...prev];
                updated[tempIndex] = {
                  id: newMessage.id,
                  nickname: newMessage.nickname,
                  message: newMessage.message,
                  timestamp: new Date(newMessage.created_at).getTime(),
                };
                return updated.sort((a, b) => a.timestamp - b.timestamp);
              }
              return prev;
            }
            
            return [...prev, {
              id: newMessage.id,
              nickname: newMessage.nickname,
              message: newMessage.message,
              timestamp: new Date(newMessage.created_at).getTime(),
            }].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Chat Realtime 구독 성공 - roomCode:', roomCode);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Chat Realtime 구독 오류:', err);
        } else {
          console.log('🔄 Chat Realtime 구독 상태:', status);
        }
      });

    // 기존 메시지 로드 (재시도 로직 포함)
    const loadMessages = async (retryCount = 0) => {
      try {
        console.log(`📥 채팅 메시지 로드 시도 (재시도 ${retryCount}) - roomCode: ${roomCode}`);
        const { data, error } = await supabase
          .from('room_chats')
          .select('*')
          .eq('room_code', roomCode)
          .order('created_at', { ascending: true })
          .limit(100); // 최근 100개만

        if (error) {
          console.error('❌ 채팅 메시지 로드 오류:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            retryCount,
          });
          
          // PostgREST 스키마 캐시 문제인 경우 재시도
          if ((error.code === '42P01' || 
              error.message?.includes('does not exist') || 
              error.message?.includes('schema cache') ||
              error.message?.includes('Could not find the table')) && retryCount < 3) {
            console.warn(`⚠️ PostgREST 스키마 캐시 문제 (재시도 ${retryCount + 1}/3):`, error.message);
            // 재시도 간격 증가: 2초, 5초, 10초
            const delay = [2000, 5000, 10000][retryCount] || 10000;
            setTimeout(() => {
              loadMessages(retryCount + 1);
            }, delay);
            return;
          }
          
          if (error.code === '42P01' || 
              error.message?.includes('does not exist') || 
              error.message?.includes('schema cache') ||
              error.message?.includes('Could not find the table')) {
            console.error('❌ PostgREST가 room_chats 테이블을 인식하지 못합니다.');
            console.error('📋 해결 방법:');
            console.error('   1. Supabase 대시보드 → Settings → API → "Reload schema cache" 클릭');
            console.error('   2. 10-60초 대기 후 페이지 새로고침 (Ctrl + Shift + R)');
            console.error('   3. 테이블이 public schema에 있는지 확인');
            console.error('   4. RLS 정책이 올바르게 설정되었는지 확인');
            console.warn('💡 Realtime은 작동 중이므로 실시간 메시지는 받을 수 있습니다.');
            // 테이블이 없어도 채팅 기능은 계속 사용 가능 (새 메시지는 실시간으로만 표시)
            // 빈 배열로 설정하여 UI는 정상 작동
            setMessages([]);
          } else if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('RLS')) {
            // RLS 권한 오류
            console.error('❌ RLS 권한 오류: room_chats 테이블에 대한 읽기 권한이 없습니다.');
            console.error('📋 해결 방법:');
            console.error('   1. Supabase SQL Editor에서 다음 정책이 있는지 확인:');
            console.error('      CREATE POLICY "Anyone can read room_chats" ON room_chats FOR SELECT USING (true);');
            console.error('   2. GRANT SELECT ON public.room_chats TO anon, authenticated; 실행');
            setMessages([]);
          } else {
            console.error('채팅 메시지 로드 오류:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            setMessages([]);
          }
          return;
        }

        console.log(`✅ 채팅 메시지 로드 성공: ${data?.length || 0}개 메시지`);
        if (data) {
          setMessages(data.map(msg => ({
            id: msg.id,
            nickname: msg.nickname,
            message: msg.message,
            timestamp: new Date(msg.created_at).getTime(),
          })));
        } else {
          setMessages([]);
        }
      } catch (err: any) {
        console.error('채팅 메시지 로드 오류:', {
          error: err,
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
        });
        // 에러가 있어도 빈 배열로 설정
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();

    return () => {
      chatChannel.unsubscribe();
    };
  }, [roomCode, nickname]); // nickname을 의존성에 추가하여 재구독 보장

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !nickname) return;

    const messageToSend = messageText.trim();
    setMessageText('');

    // Optimistic UI: 즉시 메시지 추가
    const tempId = `temp-chat-${Date.now()}-${Math.random()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      nickname: nickname,
      message: messageToSend,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, tempMessage].sort((a, b) => a.timestamp - b.timestamp));

    try {
      const { data, error } = await supabase
        .from('room_chats')
        .insert({
          room_code: roomCode,
          nickname: nickname,
          message: messageToSend,
        })
        .select()
        .single();

        if (error) {
          // 실패 시 임시 메시지 제거
          setMessages(prev => prev.filter(m => m.id !== tempId));
          
          // PostgREST 스키마 캐시 문제인 경우
          if (error.code === '42P01' || 
              error.message?.includes('does not exist') || 
              error.message?.includes('schema cache') ||
              error.message?.includes('Could not find the table')) {
            alert('❌ PostgREST가 room_chats 테이블을 인식하지 못합니다.\n\n📋 해결 방법:\n1. Supabase 대시보드 → Settings → API\n2. "Reload schema cache" 버튼 클릭\n3. 10-60초 대기 후 페이지 새로고침 (Ctrl + Shift + R)\n\n💡 Realtime은 작동하므로 실시간 메시지는 받을 수 있습니다.');
          } else {
            console.error('채팅 메시지 전송 오류:', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            alert(`메시지 전송에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
          }
          setMessageText(messageToSend); // 실패 시 다시 입력
          return;
        }

      // 성공 시 임시 메시지를 실제 메시지로 교체
      // 하지만 Realtime으로 이미 받았을 수 있으므로 중복 체크
      if (data) {
        setMessages(prev => {
          // Realtime으로 이미 받았는지 확인
          const alreadyReceived = prev.some(m => m.id === data.id);
          if (alreadyReceived) {
            // 이미 받았으면 임시 메시지만 제거
            return prev.filter(m => m.id !== tempId);
          }
          
          // 임시 메시지를 실제 메시지로 교체
          const withoutTemp = prev.filter(m => m.id !== tempId);
          return [...withoutTemp, {
            id: data.id,
            nickname: data.nickname,
            message: data.message,
            timestamp: new Date(data.created_at).getTime(),
          }].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    } catch (err: any) {
      // 실패 시 임시 메시지 제거
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      console.error('채팅 메시지 전송 오류:', {
        error: err,
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      alert('메시지 전송에 실패했습니다.');
      setMessageText(messageToSend); // 실패 시 다시 입력
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="bg-ink-700 rounded-xl border border-brass/20 flex flex-col h-[400px] sm:h-[500px]">
      <div className="p-3 sm:p-4 border-b border-brass/20">
        <h3 className="text-sm sm:text-base font-semibold text-brass flex items-center gap-2">
          <i className="ri-chat-3-line"></i>
          {title || t.room.chat}
        </h3>
      </div>

      {/* 메시지 목록 */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2"
      >
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-400 mx-auto mb-2"></div>
            <p className="text-xs text-fog">채팅 로딩 중...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            {gamePhase === 'SPEAKING' || gamePhase === 'VOTING' || gamePhase === 'RESULT' ? (
              <>
                <p className="text-xs sm:text-sm text-fog">
                  {lang === 'ko' ? '아직 메시지가 없습니다.' : 'No messages yet.'}
                </p>
                <p className="text-xs text-fog-dim mt-1">
                  {lang === 'ko' ? '게임 대화를 시작해보세요!' : 'Start the game chat!'}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs sm:text-sm text-fog">{t.room.noMessagesYet}</p>
                <p className="text-xs text-fog-dim mt-1">{t.room.startChatting}</p>
                <p className="text-xs text-amber-400/70 mt-2 px-2">
                  {t.room.realtimeMessagesWorking}
                </p>
              </>
            )}
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.nickname === nickname;
            const isSystemMessage = msg.nickname === 'SYSTEM';
            
            // 시스템 메시지 스타일
            if (isSystemMessage) {
              return (
                <div
                  key={msg.id}
                  className="flex justify-center my-2"
                >
                  <div className="bg-ink-600/50 text-fog text-xs px-3 py-1.5 rounded-full border border-brass/25/50">
                    {msg.message}
                  </div>
                </div>
              );
            }
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex items-center gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  <span className={`text-xs font-semibold ${
                    isOwnMessage ? 'text-brass' : 'text-brass'
                  }`}>
                    {msg.nickname}
                  </span>
                  <span className="text-xs text-fog-dim">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`max-w-[80%] sm:max-w-[75%] rounded-lg px-3 py-2 text-xs sm:text-sm break-words ${
                    isOwnMessage
                      ? 'bg-brass/20 text-brass-300 border border-brass/30'
                      : 'bg-ink-600 text-bone-muted border border-brass/25'
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
      <form onSubmit={handleSubmitMessage} className="p-3 sm:p-4 border-t border-brass/20">
        <div className="flex gap-2">
          <input
            ref={messageInputRef}
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={nickname ? t.room.enterMessage : t.room.enterNicknameToChat}
            disabled={!nickname}
            className="flex-1 bg-ink-800 border border-brass/20 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={!messageText.trim() || !nickname}
            className="px-3 sm:px-4 py-2 bg-brass hover:bg-brass-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm touch-manipulation"
          >
            <i className="ri-send-plane-line"></i>
          </button>
        </div>
        {!nickname && (
          <p className="text-xs text-amber-400/70 mt-2 text-center">
            {t.room.enterNicknameToChatDesc}
          </p>
        )}
      </form>
    </div>
  );
}

