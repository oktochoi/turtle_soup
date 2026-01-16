'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Question, Guess, Room } from '@/lib/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import StoryPanel from './StoryPanel';
import QuestionInput from './QuestionInput';
import QuestionList from './QuestionList';
import HostAnswerButtons from './HostAnswerButtons';
import GuessInput from './GuessInput';
import HostAnswerInbox from './HostAnswerInbox';
import GameResultModal from './GameResultModal';
import ChatPanel from './ChatPanel';

type LocalQuestion = {
  id: string;
  nickname: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant' | null;
  timestamp: number;
};

type LocalGuess = {
  id: string;
  nickname: string;
  text: string;
  judged: boolean;
  correct: boolean;
  timestamp: number;
};

export default function RoomPage({ params }: { params: Promise<{ lang: string; code: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const roomCode = resolvedParams.code;
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations();
  
  const [isHost, setIsHost] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [userWon, setUserWon] = useState(false); // 정답 맞춘 유저만 개인적으로 종료
  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [maxQuestions, setMaxQuestions] = useState<number | null>(30);
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [guesses, setGuesses] = useState<LocalGuess[]>([]);
  const [players, setPlayers] = useState<Array<{ nickname: string; is_host: boolean; is_ready?: boolean }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomPassword, setRoomPassword] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [roomCreatedAt, setRoomCreatedAt] = useState<Date | null>(null);
  const [lastChatAt, setLastChatAt] = useState<Date | null>(null);

  // Supabase에서 방 정보 로드
  useEffect(() => {
    const loadRoom = async () => {
      // Supabase 환경 변수 확인
      if (!isSupabaseConfigured()) {
        setError(lang === 'ko' 
          ? 'Supabase가 설정되지 않았습니다.\n\n.env.local 파일을 확인하고 개발 서버를 재시작하세요.'
          : 'Supabase is not configured.\n\nPlease check your .env.local file and restart the development server.');
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
          // 방을 찾을 수 없으면 삭제된 것으로 간주 (게임 종료됨)
          if (roomError.code === 'PGRST116' || roomError.message?.includes('No rows')) {
            console.log('✅ 방이 삭제되었습니다 - 게임 종료 상태로 간주');
            setGameEnded(true);
            // 게임 종료 모달을 표시하기 위해 최소한의 데이터 설정
            setStory(t.room.gameEndedMessage);
            setTruth(t.room.gameEndedMessage);
            setIsLoading(false);
            return;
          } else {
            throw roomError;
          }
        }

        if (room) {
          setStory(room.story);
          setTruth(room.truth);
          // 999999는 무제한을 의미
          setMaxQuestions(room.max_questions >= 999999 ? null : room.max_questions);
          setGameEnded(room.game_ended || room.status === 'done');
          setRoomPassword(room.password);
          setRoomCreatedAt(room.created_at ? new Date(room.created_at) : null);
        }
      } catch (err) {
        console.error('방 로드 오류:', err);
        setError(t.room.loadRoomFail);
      } finally {
        setIsLoading(false);
      }
    };

    loadRoom();
  }, [roomCode]);

  // 호스트 여부와 관전 모드를 URL 파라미터에서 먼저 확인 (즉시 설정)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const hostParam = urlParams.get('host') === 'true';
    const spectatorParam = urlParams.get('spectator') === 'true';
    
    // URL에 host=true가 있으면 즉시 호스트로 설정
    if (hostParam) {
      console.log('✅ 호스트로 접속 감지, isHost를 true로 설정');
      setIsHost(true);
    }
    
    // URL에 spectator=true가 있으면 관전 모드로 설정
    if (spectatorParam) {
      console.log('✅ 관전 모드로 접속 감지');
      setIsSpectator(true);
      // 관전 모드도 채팅을 위해 닉네임 입력 필요
      // 닉네임이 없으면 모달 표시
      const savedNickname = localStorage.getItem(`nickname_${roomCode}`);
      if (!savedNickname) {
        setShowNicknameModal(true);
      } else {
        setNickname(savedNickname);
        setShowNicknameModal(false);
      }
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // URL 파라미터에서 호스트 여부와 닉네임 확인, localStorage에서 닉네임 불러오기
  useEffect(() => {
    if (typeof window === 'undefined' || isLoading) return;

      const urlParams = new URLSearchParams(window.location.search);
    const hostParam = urlParams.get('host') === 'true';
    const nicknameParam = urlParams.get('nickname');
    const passwordParam = urlParams.get('password');
    
    // 호스트 여부를 먼저 설정 (roomPassword 로딩과 관계없이)
    // URL 파라미터에서 호스트 여부 확인
    if (hostParam) {
      console.log('✅ 호스트로 접속:', hostParam);
      setIsHost(true);
      console.log('✅ isHost 상태 설정됨:', true);
      
      if (nicknameParam) {
        const decodedNickname = decodeURIComponent(nicknameParam);
        setNickname(decodedNickname);
        setShowNicknameModal(false);
        localStorage.setItem(`nickname_${roomCode}`, decodedNickname);
        localStorage.setItem(`roomCode_${roomCode}`, roomCode);
        joinRoom(decodedNickname, true);
      } else {
        // 호스트인데 닉네임이 없으면 localStorage에서 가져오기
        const savedNickname = localStorage.getItem(`nickname_${roomCode}`);
        if (savedNickname) {
          setNickname(savedNickname);
          setShowNicknameModal(false);
          joinRoom(savedNickname, true);
        } else {
          setShowNicknameModal(true);
        }
      }
      return;
    }
    
    // 호스트가 아닌 경우, 데이터베이스에서 실제 호스트 여부 확인
    const checkHostStatus = async () => {
      if (nicknameParam) {
        const { data: playerData } = await supabase
          .from('players')
          .select('is_host')
          .eq('room_code', roomCode)
          .eq('nickname', decodeURIComponent(nicknameParam))
          .single();
        
        if (playerData) {
          setIsHost(playerData.is_host || false);
        }
      }
    };
    
    checkHostStatus();
    
    // 비밀번호가 아직 로드되지 않았으면 대기
    if (roomPassword === null) return;
    
    // URL에 닉네임이 이미 있으면 (rooms 페이지에서 설정한 경우)
    if (nicknameParam) {
      const decodedNickname = decodeURIComponent(nicknameParam);
      setNickname(decodedNickname);
      setShowNicknameModal(false); // 닉네임 모달 표시하지 않음
      // localStorage에 저장
      localStorage.setItem(`nickname_${roomCode}`, decodedNickname);
      localStorage.setItem(`roomCode_${roomCode}`, roomCode);
      
      // 비밀번호가 있는 방인 경우 체크
      if (roomPassword) {
        // URL에 비밀번호가 없거나 틀리면 비밀번호 모달 표시
        if (!passwordParam || passwordParam !== roomPassword) {
          setShowPasswordModal(true);
          return;
        }
        // 비밀번호가 맞으면 방 참여
        joinRoom(decodedNickname, hostParam);
      } else {
        // 비밀번호가 없으면 바로 방 참여
        joinRoom(decodedNickname, hostParam);
      }
      return;
    }
    
    // URL에 닉네임이 없는 경우 (직접 URL로 접근한 경우)
    // localStorage에서 저장된 닉네임 확인 (같은 방 코드인 경우만)
    const savedNickname = localStorage.getItem(`nickname_${roomCode}`);
    const savedRoomCode = localStorage.getItem(`roomCode_${roomCode}`);
    
    if (savedNickname && savedRoomCode === roomCode) {
      // localStorage에 저장된 닉네임이 있고 같은 방이면 사용
      console.log('💾 저장된 닉네임 불러오기:', savedNickname);
      setNickname(savedNickname);
      setShowNicknameModal(false);
      
      // 비밀번호가 있는 방인 경우 체크
      if (roomPassword) {
        // URL에 비밀번호가 없거나 틀리면 비밀번호 모달 표시
        if (!passwordParam || passwordParam !== roomPassword) {
          setShowPasswordModal(true);
          return;
        }
        // 비밀번호가 맞으면 방 참여
        joinRoom(savedNickname, hostParam);
      } else {
        // 비밀번호가 없으면 바로 방 참여
        joinRoom(savedNickname, hostParam);
      }
    } else {
      // 둘 다 없으면 닉네임 모달 표시
      setShowNicknameModal(true);
    }
  }, [roomCode, isLoading, roomPassword]);

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

      if (playerError && playerError.code !== '23505') { // 23505는 중복 키 오류
        console.error('플레이어 추가 오류:', playerError);
      }
    } catch (err) {
      console.error('방 참여 오류:', err);
    }
  };

  // 실시간 구독 설정
  useEffect(() => {
    if (!roomCode || showNicknameModal) return;

    // Questions 실시간 구독
    const questionsChannel = supabase
      .channel(`questions:${roomCode}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('🔔 Questions Realtime 이벤트:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            const newQuestion = payload.new as Question;
            console.log('➕ 새 질문 INSERT (Realtime):', newQuestion);
            setQuestions(prev => {
              // 이미 존재하는 질문이면 스킵 (ID로 체크)
              const existsById = prev.some(q => q.id === newQuestion.id);
              if (existsById) {
                console.log('⏭️ 질문 이미 존재 (ID), 스킵:', newQuestion.id);
                return prev;
              }
              
              // 임시 질문이 있으면 실제 ID로 교체 (텍스트와 닉네임으로 매칭)
              const tempQuestionIndex = prev.findIndex(q => 
                q.id.startsWith('temp-') && 
                q.text.trim() === newQuestion.text.trim() && 
                q.nickname === newQuestion.nickname
              );
              
              if (tempQuestionIndex !== -1) {
                // 임시 질문을 실제 질문으로 교체
                console.log('🔄 임시 질문을 실제 질문으로 교체:', newQuestion.id);
                const newQuestions = [...prev];
                newQuestions[tempQuestionIndex] = {
                  id: newQuestion.id,
                  nickname: newQuestion.nickname,
                  text: newQuestion.text,
                  answer: newQuestion.answer,
                  timestamp: new Date(newQuestion.created_at).getTime(),
                };
                return newQuestions;
              } else {
                // 새 질문 추가 (다른 사용자가 작성한 질문 - 모든 사용자에게 즉시 표시)
                console.log('✨ 새 질문 추가 (Realtime - 다른 사용자):', newQuestion);
                const newQuestionItem = {
                  id: newQuestion.id,
                  nickname: newQuestion.nickname,
                  text: newQuestion.text,
                  answer: newQuestion.answer,
                  timestamp: new Date(newQuestion.created_at).getTime(),
                };
                // 기존 질문에 새 질문 추가 (정렬은 QuestionList에서 처리)
                return [...prev, newQuestionItem];
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedQuestion = payload.new as Question;
            console.log('질문 업데이트:', updatedQuestion);
            setQuestions(prev => {
              const existing = prev.find(q => q.id === updatedQuestion.id);
              // 답변이 실제로 변경된 경우에만 업데이트
              if (existing) {
                // 이미 같은 답변이면 스킵 (중복 방지)
                if (existing.answer === updatedQuestion.answer) {
                  return prev;
                }
                // 답변이 변경되었으면 업데이트 (모든 사용자에게 즉시 반영)
                console.log('질문 답변 업데이트:', updatedQuestion.id, updatedQuestion.answer);
                return prev.map(q => q.id === updatedQuestion.id ? {
                  ...q,
                  answer: updatedQuestion.answer,
                } : q);
              }
              // 질문이 없으면 추가
              console.log('질문 추가 (UPDATE 이벤트):', updatedQuestion);
              return [...prev, {
                id: updatedQuestion.id,
                nickname: updatedQuestion.nickname,
                text: updatedQuestion.text,
                answer: updatedQuestion.answer,
                timestamp: new Date(updatedQuestion.created_at).getTime(),
              }];
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Questions Realtime 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Questions Realtime 구독 오류:', err);
        } else {
          console.log('🔄 Questions Realtime 구독 상태:', status);
        }
      });

    // Guesses 실시간 구독
    const guessesChannel = supabase
      .channel(`guesses:${roomCode}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guesses',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('🔔 Guesses Realtime 이벤트:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            const newGuess = payload.new as Guess;
            console.log('➕ 새 추측 INSERT (Realtime):', newGuess);
            setGuesses(prev => {
              // 이미 존재하는 추측이면 스킵 (ID로 체크)
              const existsById = prev.some(g => g.id === newGuess.id);
              if (existsById) {
                console.log('⏭️ 추측 이미 존재 (ID), 스킵:', newGuess.id);
                return prev;
              }
              
              // 임시 추측이 있으면 실제 ID로 교체 (텍스트와 닉네임으로 매칭)
              const tempGuessIndex = prev.findIndex(g => 
                g.id.startsWith('temp-guess-') && 
                g.text.trim() === newGuess.text.trim() && 
                g.nickname === newGuess.nickname
              );
              
              if (tempGuessIndex !== -1) {
                // 임시 추측을 실제 추측으로 교체
                console.log('🔄 임시 추측을 실제 추측으로 교체:', newGuess.id);
                const newGuesses = [...prev];
                newGuesses[tempGuessIndex] = {
                  id: newGuess.id,
                  nickname: newGuess.nickname,
                  text: newGuess.text,
                  judged: newGuess.judged,
                  correct: newGuess.correct,
                  timestamp: new Date(newGuess.created_at).getTime(),
                };
                return newGuesses;
              } else {
                // 새 추측 추가 (다른 사용자가 작성한 추측 - 모든 사용자에게 즉시 표시)
                console.log('✨ 새 추측 추가 (Realtime - 다른 사용자):', newGuess);
                return [...prev, {
                  id: newGuess.id,
                  nickname: newGuess.nickname,
                  text: newGuess.text,
                  judged: newGuess.judged,
                  correct: newGuess.correct,
                  timestamp: new Date(newGuess.created_at).getTime(),
                }].sort((a, b) => a.timestamp - b.timestamp);
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedGuess = payload.new as Guess;
            console.log('추측 업데이트:', updatedGuess);
            setGuesses(prev => {
              const existing = prev.find(g => g.id === updatedGuess.id);
              // 판정 상태가 실제로 변경된 경우에만 업데이트
              if (existing) {
                // 이미 같은 상태면 스킵 (중복 방지)
                if (existing.judged === updatedGuess.judged && existing.correct === updatedGuess.correct) {
                  return prev;
                }
                // 상태가 변경되었으면 업데이트 (모든 사용자에게 즉시 반영)
                console.log('추측 판정 업데이트:', updatedGuess.id, updatedGuess.judged, updatedGuess.correct);
                const updatedGuesses = prev.map(g => g.id === updatedGuess.id ? {
                  ...g,
                  judged: updatedGuess.judged,
                  correct: updatedGuess.correct,
                } : g);
                
                // 정답 맞춘 유저는 개인적으로 종료 처리
                if (updatedGuess.correct && updatedGuess.judged) {
                  const guess = updatedGuesses.find(g => g.id === updatedGuess.id);
                  if (guess && guess.nickname === nickname) {
                    setUserWon(true);
                    console.log('✅ 사용자가 정답을 맞췄습니다!');
                  }
                  
                  // 모든 플레이어가 정답을 맞췄는지 확인
                  checkAllPlayersCorrect(updatedGuesses).then(allCorrect => {
                    if (allCorrect) {
                      console.log('🎉 모든 플레이어가 정답을 맞춰 게임이 자동 종료되었습니다');
                    }
                  });
                }
                
                return updatedGuesses;
              }
              // 추측이 없으면 추가
              console.log('추측 추가 (UPDATE 이벤트):', updatedGuess);
              return [...prev, {
                id: updatedGuess.id,
                nickname: updatedGuess.nickname,
                text: updatedGuess.text,
                judged: updatedGuess.judged,
                correct: updatedGuess.correct,
                timestamp: new Date(updatedGuess.created_at).getTime(),
              }];
            });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Guesses Realtime 구독 성공');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Guesses Realtime 구독 오류:', err);
        } else {
          console.log('🔄 Guesses Realtime 구독 상태:', status);
        }
      });

    // Room 실시간 구독
    const roomChannel = supabase
      .channel(`room:${roomCode}`, {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          console.log('🔔 Room Realtime 이벤트:', payload.eventType, payload.new);
          const updatedRoom = payload.new as Room;
          console.log('📊 Room 상태:', {
            status: updatedRoom.status,
            game_ended: updatedRoom.game_ended,
            code: updatedRoom.code
          });
          
          if (updatedRoom.status === 'done' || updatedRoom.game_ended) {
            console.log('✅ 게임 종료 상태 전파됨 - 모든 사용자에게 모달 표시');
            console.log('🎯 gameEnded 상태를 true로 설정합니다 (모든 사용자)');
            setGameEnded(true);
            // 강제로 상태 업데이트 확인 (Realtime 지연 대비)
            setTimeout(() => {
              console.log('🔄 gameEnded 상태 재확인 및 강제 업데이트');
              setGameEnded(true);
            }, 200);
          } else {
            // 게임이 다시 시작된 경우
            setGameEnded(false);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Room Realtime 구독 성공 - 게임 종료 상태를 실시간으로 받을 수 있습니다');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Room Realtime 구독 오류:', err);
        } else {
          console.log('🔄 Room Realtime 구독 상태:', status);
        }
      });

    // Players 실시간 구독 (참가자 입장/퇴장 감지)
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
        async (payload) => {
          console.log('🔔 Players Realtime 이벤트:', payload.eventType);
          // 참가자 목록 다시 로드
          const { data: playersData } = await supabase
            .from('players')
            .select('nickname, is_host')
            .eq('room_code', roomCode);
          
          if (playersData) {
            const newPlayers = playersData.map(p => ({
              nickname: p.nickname,
              is_host: p.is_host,
              is_ready: false,
            }));
            setPlayers(newPlayers);
            
            // 새 참가자 입장 알림 (호스트에게만)
            if (isHost && payload.eventType === 'INSERT') {
              const newPlayer = payload.new as { nickname: string };
              if (newPlayer.nickname !== nickname) {
                // 토스트 알림 (간단하게 alert 사용)
                setTimeout(() => {
                  alert(lang === 'ko' 
                    ? `🎉 ${newPlayer.nickname}님이 참가했습니다!` 
                    : `🎉 ${newPlayer.nickname} joined!`);
                }, 300);
              }
            }
            
            // 참가자 퇴장 알림 (호스트에게만)
            if (isHost && payload.eventType === 'DELETE') {
              const leftPlayer = payload.old as { nickname: string };
              if (leftPlayer.nickname !== nickname) {
                // 토스트 알림
                setTimeout(() => {
                  alert(lang === 'ko' 
                    ? `👋 ${leftPlayer.nickname}님이 나갔습니다.` 
                    : `👋 ${leftPlayer.nickname} left.`);
                }, 300);
              }
            }
          }
        }
      )
      .subscribe();

    // 채팅 실시간 구독 (최근 대화 시간 업데이트용)
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
          // 새 채팅 메시지가 올 때마다 최근 대화 시간 업데이트
          if (payload.new && payload.new.created_at) {
            setLastChatAt(new Date(payload.new.created_at));
          }
        }
      )
      .subscribe();

    // 기존 데이터 로드
    const loadInitialData = async () => {
      try {
        // 방 상태도 함께 확인
        const roomRes = await supabase
          .from('rooms')
          .select('*')
          .eq('code', roomCode)
          .single();
        
        if (roomRes.error) {
          // 방을 찾을 수 없으면 삭제된 것으로 간주 (게임 종료됨)
          if (roomRes.error.code === 'PGRST116' || roomRes.error.message?.includes('No rows')) {
            console.log('✅ 방이 삭제되었습니다 - 게임 종료 상태로 간주');
            setGameEnded(true);
          } else {
            console.error('방 로드 오류:', roomRes.error);
          }
        } else if (roomRes.data) {
          const room = roomRes.data as Room;
          console.log('📊 초기 방 상태:', {
            status: room.status,
            game_ended: room.game_ended
          });
          if (room.status === 'done' || room.game_ended) {
            console.log('✅ 게임이 이미 종료된 상태입니다');
            setGameEnded(true);
          }
        }

        const [questionsRes, guessesRes, playersRes, lastChatRes] = await Promise.all([
          supabase
            .from('questions')
            .select('*')
            .eq('room_code', roomCode)
            .order('created_at', { ascending: true }),
          supabase
            .from('guesses')
            .select('*')
            .eq('room_code', roomCode)
            .order('created_at', { ascending: true }),
          supabase
            .from('players')
            .select('nickname, is_host')
            .eq('room_code', roomCode),
          supabase
            .from('room_chats')
            .select('created_at')
            .eq('room_code', roomCode)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (questionsRes.error) {
          console.error('질문 로드 오류:', questionsRes.error);
        } else if (questionsRes.data) {
          console.log('기존 질문 로드:', questionsRes.data.length, '개');
          setQuestions(questionsRes.data.map(q => ({
            id: q.id,
            nickname: q.nickname,
            text: q.text,
            answer: q.answer,
            timestamp: new Date(q.created_at).getTime(),
          })));
        }

        if (guessesRes.error) {
          console.error('추측 로드 오류:', guessesRes.error);
        } else if (guessesRes.data) {
          console.log('기존 추측 로드:', guessesRes.data.length, '개');
          const loadedGuesses = guessesRes.data.map(g => ({
            id: g.id,
            nickname: g.nickname,
            text: g.text,
            judged: g.judged,
            correct: g.correct,
            timestamp: new Date(g.created_at).getTime(),
          }));
          setGuesses(loadedGuesses);
          
          // 모든 플레이어가 정답을 맞췄는지 확인
          if (playersRes.data && playersRes.data.length > 0) {
            checkAllPlayersCorrect(loadedGuesses).then(allCorrect => {
              if (allCorrect) {
                console.log('✅ 초기 로드 시 모든 플레이어가 이미 정답을 맞춘 상태입니다');
              }
            });
          }
        }

        if (playersRes.error) {
          console.error('플레이어 로드 오류:', playersRes.error);
        } else if (playersRes.data) {
          console.log('기존 플레이어 로드:', playersRes.data.length, '명');
          setPlayers(playersRes.data.map(p => ({
            nickname: p.nickname,
            is_host: p.is_host,
            is_ready: false,
          })));
        }

        // 최근 대화 시간 업데이트
        if (lastChatRes.data && lastChatRes.data.created_at) {
          setLastChatAt(new Date(lastChatRes.data.created_at));
        } else {
          setLastChatAt(null);
        }
      } catch (err) {
        console.error('초기 데이터 로드 오류:', err);
      }
    };

    loadInitialData();

    // Polling 제거 - Realtime으로 대체됨
    // Realtime 구독이 모든 상태 변경을 실시간으로 처리하므로 polling 불필요
    console.log('✅ Realtime 구독 활성화 - Polling 제거됨');

    // 현재 방의 활동 시간도 체크하여 1시간 이상 비활성이면 경고
    const checkInactivity = async () => {
      try {
        const { data: roomData } = await supabase
          .from('rooms')
          .select('last_activity_at, created_at')
          .eq('code', roomCode)
          .single();
        
        if (roomData) {
          const lastActivity = roomData.last_activity_at 
            ? new Date(roomData.last_activity_at).getTime()
            : new Date(roomData.created_at).getTime();
          const now = Date.now();
          const inactiveMinutes = (now - lastActivity) / (1000 * 60);
          
          // 50분 이상 비활성이면 경고 (1시간 전에 경고)
          if (inactiveMinutes >= 50 && inactiveMinutes < 60) {
            console.warn(`⚠️ 방이 ${Math.floor(inactiveMinutes)}분 동안 비활성 상태입니다. 곧 자동으로 제거될 수 있습니다.`);
          }
        }
      } catch (error) {
        // 무시
      }
    };

    // 10분마다 현재 방의 비활성 상태 체크
    const inactivityCheckInterval = setInterval(checkInactivity, 10 * 60 * 1000);

    return () => {
      questionsChannel.unsubscribe();
      guessesChannel.unsubscribe();
      roomChannel.unsubscribe();
      playersChannel.unsubscribe();
      chatTimeChannel.unsubscribe();
      // Polling 제거됨 - Realtime으로 대체
      clearInterval(inactivityCheckInterval);
    };
  }, [roomCode, showNicknameModal]);

  const handleSubmitQuestion = async (text: string) => {
    if (!text.trim() || gameEnded || !nickname) return;

    // 최대 질문 개수 체크 (무제한이 아닐 때만)
    if (maxQuestions !== null && questions.length >= maxQuestions) {
      alert(lang === 'ko' 
        ? `최대 질문 개수(${maxQuestions}개)에 도달했습니다. 더 이상 질문할 수 없습니다.`
        : `Maximum questions (${maxQuestions}) reached. You cannot ask more questions.`);
      return;
    }

    // Optimistic UI: 즉시 화면에 추가
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const newQuestion: LocalQuestion = {
      id: tempId,
      nickname: nickname,
      text: text.trim(),
      answer: null,
      timestamp: Date.now(),
    };
    setQuestions(prev => [...prev, newQuestion]);

    try {
      const { data, error } = await supabase
        .from('questions')
        .insert({
          room_code: roomCode,
          nickname: nickname,
          text: text.trim(),
          answer: null,
        })
        .select()
        .single();

      if (error) throw error;

      // 실제 ID로 업데이트 (Realtime이 중복 추가하는 것을 방지)
      if (data) {
        console.log('✅ 질문 제출 성공, ID 업데이트:', data.id);
        setQuestions(prev => 
          prev.map(q => q.id === tempId ? {
            ...q,
            id: data.id,
            timestamp: new Date(data.created_at).getTime(),
          } : q)
        );
      }
    } catch (err) {
      console.error('질문 제출 오류:', err);
      // 실패 시 롤백
      setQuestions(prev => prev.filter(q => q.id !== tempId));
      alert(t.room.questionSubmitFail);
    }
  };

  const handleAnswerQuestion = async (questionId: string, answer: 'yes' | 'no' | 'irrelevant') => {
    if (!isHost) return;

    // Optimistic UI: 즉시 화면에 반영
    setQuestions(prev =>
      prev.map(q => q.id === questionId ? { ...q, answer } : q)
    );
    setSelectedQuestionId(null);

    try {
      const { error } = await supabase
        .from('questions')
        .update({ answer })
        .eq('id', questionId);

      if (error) throw error;
    } catch (err) {
      console.error('답변 제출 오류:', err);
      // 실패 시 롤백
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, answer: null } : q)
      );
      setSelectedQuestionId(questionId);
      alert(t.room.answerSubmitFail);
    }
  };

  const handleSubmitGuess = async (text: string) => {
    if (!text.trim() || gameEnded || !nickname) return;

    // Optimistic UI: 즉시 화면에 추가
    const tempId = `temp-guess-${Date.now()}-${Math.random()}`;
    const newGuess: LocalGuess = {
      id: tempId,
      nickname: nickname,
      text: text.trim(),
      judged: false,
      correct: false,
      timestamp: Date.now(),
    };
    setGuesses(prev => [...prev, newGuess]);

    try {
      const { data, error } = await supabase
        .from('guesses')
        .insert({
          room_code: roomCode,
          nickname: nickname,
          text: text.trim(),
          judged: false,
          correct: false,
        })
        .select()
        .single();

      if (error) throw error;

      // 실제 ID로 업데이트 (Realtime이 중복 추가하는 것을 방지)
      if (data) {
        console.log('✅ 추측 제출 성공, ID 업데이트:', data.id);
        setGuesses(prev => 
          prev.map(g => g.id === tempId ? {
            ...g,
            id: data.id,
            timestamp: new Date(data.created_at).getTime(),
          } : g)
        );
      }
    } catch (err) {
      console.error('추측 제출 오류:', err);
      // 실패 시 롤백
      setGuesses(prev => prev.filter(g => g.id !== tempId));
      alert(t.room.guessSubmitFail);
    }
  };

  // 모든 플레이어가 정답을 맞췄는지 확인하는 함수
  const checkAllPlayersCorrect = async (updatedGuesses: LocalGuess[]) => {
    try {
      // 플레이어 목록 가져오기
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('nickname')
        .eq('room_code', roomCode);
      
      if (playersError || !playersData) {
        console.error('플레이어 조회 오류:', playersError);
        return false;
      }

      const playerNicknames = playersData.map(p => p.nickname);
      const correctGuesses = updatedGuesses.filter(g => g.judged && g.correct);
      const correctPlayerNicknames = new Set(correctGuesses.map(g => g.nickname));

      // 모든 플레이어가 정답을 맞췄는지 확인
      const allCorrect = playerNicknames.every(nickname => correctPlayerNicknames.has(nickname));
      
      if (allCorrect && playerNicknames.length > 0) {
        console.log('🎉 모든 플레이어가 정답을 맞췄습니다! 게임을 자동 종료합니다.');
        // 게임 종료 상태로 업데이트
        await supabase
          .from('rooms')
          .update({ 
            game_ended: true,
            status: 'done'
          })
          .eq('code', roomCode);
        return true;
      }
      return false;
    } catch (err) {
      console.error('모든 플레이어 정답 확인 오류:', err);
      return false;
    }
  };

  const handleJudgeGuess = async (guessId: string, correct: boolean) => {
    if (!isHost) return;

    // Optimistic UI: 즉시 화면에 반영
    setGuesses(prev => {
      const updated = prev.map(g => g.id === guessId ? { ...g, judged: true, correct } : g);
      
      // 정답인 경우 모든 플레이어가 정답을 맞췄는지 확인
      if (correct) {
        checkAllPlayersCorrect(updated).then(allCorrect => {
          if (allCorrect) {
            console.log('✅ 모든 플레이어가 정답을 맞춰 게임이 종료되었습니다');
          }
        });
      }
      
      return updated;
    });

    try {
      const { error } = await supabase
        .from('guesses')
        .update({ judged: true, correct })
        .eq('id', guessId);

      if (error) throw error;

      // 업데이트 후 다시 확인
      if (correct) {
        const { data: updatedGuessesData } = await supabase
          .from('guesses')
          .select('*')
          .eq('room_code', roomCode)
          .eq('judged', true)
          .eq('correct', true);
        
        if (updatedGuessesData) {
          const updatedGuesses: LocalGuess[] = updatedGuessesData.map(g => ({
            id: g.id,
            nickname: g.nickname,
            text: g.text,
            judged: g.judged,
            correct: g.correct,
            timestamp: new Date(g.created_at).getTime(),
          }));
          
          await checkAllPlayersCorrect(updatedGuesses);
        }
      }
    } catch (err) {
      console.error('추측 판정 오류:', err);
      // 실패 시 롤백
    setGuesses(prev =>
        prev.map(g => g.id === guessId ? { ...g, judged: false, correct: false } : g)
      );
      alert(t.room.guessJudgeFail);
    }
  };

  // 호스트가 게임 종료 버튼을 눌러 전체 공개
  const handleEndGame = async () => {
    if (!isHost) return;

    if (!confirm(t.room.endGameConfirm)) {
      return;
    }

    try {
      console.log('🎮 게임 종료 시작 - 모든 사용자에게 전파됩니다');
      
      // 게임 종료 상태로 업데이트 (status를 'done'으로 변경하면 트리거가 자동으로 삭제)
      // Realtime을 통해 모든 사용자에게 전파됨
      const { error: roomError, data: updatedRoom } = await supabase
        .from('rooms')
        .update({ 
          game_ended: true,
          status: 'done'
        })
        .eq('code', roomCode)
        .select()
        .single();

      if (roomError) throw roomError;

      console.log('✅ 게임 종료 상태로 변경됨. Realtime을 통해 모든 사용자에게 전파됩니다.');
      console.log('📊 업데이트된 방 상태:', updatedRoom);
      
      // 즉시 반영 (Optimistic UI)
      setGameEnded(true);
      
      // Realtime 구독을 통해 다른 사용자들에게도 전파됨
      // 약간의 지연을 두고 다시 확인하여 Realtime이 제대로 작동하는지 확인
      setTimeout(async () => {
        const { data: roomCheck } = await supabase
          .from('rooms')
          .select('game_ended, status')
          .eq('code', roomCode)
          .single();
        
        if (roomCheck && (roomCheck.game_ended || roomCheck.status === 'done')) {
          console.log('✅ 게임 종료 상태 확인됨:', roomCheck);
          setGameEnded(true);
        }
      }, 500);
    } catch (err) {
      console.error('게임 종료 오류:', err);
      setGameEnded(false); // 오류 발생 시 상태 롤백
      alert(t.room.endGameFail);
    }
  };

  // 방 코드 복사
  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert(t.room.roomCodeCopied);
    } catch (err) {
      // 복사 실패 시 대체 방법
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(t.room.roomCodeCopied);
    }
  };

  const handleShareRoom = async () => {
    try {
      const roomUrl = `${window.location.origin}/${lang}/room/${roomCode}`;
      await navigator.clipboard.writeText(roomUrl);
      alert(t.room.roomLinkCopied);
    } catch (err) {
      // 복사 실패 시 대체 방법
      const roomUrl = `${window.location.origin}/${lang}/room/${roomCode}`;
      const textArea = document.createElement('textarea');
      textArea.value = roomUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(t.room.roomLinkCopied);
    }
  };

  const handleLeaveRoom = async () => {
    if (!nickname) return;

    // 확인 다이얼로그
    const confirmMessage = isHost 
      ? (lang === 'ko' 
          ? '호스트로 나가시면 방이 종료됩니다. 정말 나가시겠습니까?' 
          : 'Leaving as host will end the room. Are you sure?')
      : (lang === 'ko' 
          ? '방에서 나가시겠습니까?' 
          : 'Are you sure you want to leave the room?');
    
    if (!confirm(confirmMessage)) return;

    try {
      // 호스트인 경우 방 종료
      if (isHost) {
        const { error: endGameError } = await supabase
          .from('rooms')
          .update({ 
            status: 'done',
            game_ended: true 
          })
          .eq('code', roomCode);

        if (endGameError) {
          console.error('방 종료 오류:', endGameError);
        }
      }

      // players 테이블에서 제거 (실시간으로 다른 사용자들에게 반영됨)
      const { error: leaveError } = await supabase
        .from('players')
        .delete()
        .eq('room_code', roomCode)
        .eq('nickname', nickname);

      if (leaveError) {
        console.error('방 나가기 오류:', leaveError);
        // 에러가 발생해도 계속 진행 (이미 나간 상태일 수 있음)
      } else {
        // 성공적으로 나간 경우, 참가자 목록에서도 즉시 제거 (Optimistic UI)
        setPlayers(prev => prev.filter(p => p.nickname !== nickname));
      }

      // 호스트가 나간 경우 다른 플레이어에게 호스트 권한 위임 시도
      if (isHost && !leaveError) {
        // 남은 플레이어 중 첫 번째를 호스트로 지정
        const { data: remainingPlayers } = await supabase
          .from('players')
          .select('nickname')
          .eq('room_code', roomCode)
          .order('joined_at', { ascending: true })
          .limit(1);

        if (remainingPlayers && remainingPlayers.length > 0) {
          await supabase
            .from('players')
            .update({ is_host: true })
            .eq('room_code', roomCode)
            .eq('nickname', remainingPlayers[0].nickname);
        }
      }

      // localStorage에서 닉네임 제거
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`nickname_${roomCode}`);
        localStorage.removeItem(`roomCode_${roomCode}`);
      }

      // 방 목록으로 리다이렉트
      router.push(`/${lang}/rooms`);
    } catch (error) {
      console.error('방 나가기 오류:', error);
      alert(lang === 'ko' ? '방 나가기에 실패했습니다.' : 'Failed to leave room.');
    }
  };

  const handleSetNickname = async (name: string) => {
    if (!name.trim()) return;

    const trimmedName = name.trim();
    setNickname(trimmedName);
      setShowNicknameModal(false);
    
    // localStorage에 닉네임 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(`nickname_${roomCode}`, trimmedName);
      localStorage.setItem(`roomCode_${roomCode}`, roomCode);
      console.log('💾 닉네임 저장됨:', trimmedName);
    }
    
    // 비밀번호가 있는 방인 경우 비밀번호 모달 표시
    if (roomPassword) {
      // URL에 비밀번호가 이미 있으면 체크하지 않음
      const urlParams = new URLSearchParams(window.location.search);
      const passwordParam = urlParams.get('password');
      if (passwordParam && passwordParam === roomPassword) {
        // 비밀번호가 이미 맞으면 바로 참여
        await joinRoom(trimmedName, false);
      } else {
        // 비밀번호 모달 표시
        setShowPasswordModal(true);
      }
    } else {
      // 비밀번호가 없으면 바로 방 참여
      await joinRoom(trimmedName, false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!enteredPassword.trim()) {
      setError(t.room.enterPasswordAlert);
      return;
    }

    if (!roomPassword || enteredPassword !== roomPassword) {
      setError(t.room.incorrectPassword);
      setEnteredPassword('');
      return;
    }

    setShowPasswordModal(false);
    setError('');
    
    // 닉네임이 없으면 닉네임 모달 표시
    if (!nickname.trim()) {
      setShowNicknameModal(true);
      return;
    }
    
    // 비밀번호가 맞으면 방 참여
    await joinRoom(nickname.trim(), false);
  };

  // 방 삭제 로직 제거 - 게임 종료 후에도 방은 유지

  const handleRestart = async () => {
    if (!isHost) return;

    try {
      // 방 초기화
      await supabase
        .from('rooms')
        .update({ 
          game_ended: false,
          status: 'active'
        })
        .eq('code', roomCode);

      // 질문과 추측 삭제
      await Promise.all([
        supabase.from('questions').delete().eq('room_code', roomCode),
        supabase.from('guesses').delete().eq('room_code', roomCode),
      ]);

    setQuestions([]);
    setGuesses([]);
    setSelectedQuestionId(null);
    } catch (err) {
      console.error('재시작 오류:', err);
      alert(t.room.restartFail);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.room.loadingRoom}</p>
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

  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-700 shadow-2xl">
          <div className="text-center mb-6">
            <i className="ri-lock-line text-4xl sm:text-5xl text-teal-400 mb-4"></i>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{t.room.password}</h2>
            <p className="text-slate-400 text-sm">{t.room.passwordRequired}</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          <input
            type="password"
            placeholder={t.room.enterPassword}
            value={enteredPassword}
            onChange={(e) => {
              setEnteredPassword(e.target.value);
              setError('');
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePasswordSubmit();
              }
            }}
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={handlePasswordSubmit}
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition-all duration-200"
            >
              {t.common.confirm}
            </button>
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setEnteredPassword('');
                setError('');
                router.push(`/${lang}/rooms`);
              }}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-all duration-200"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showNicknameModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full border border-slate-700 shadow-2xl">
          <div className="text-center mb-6">
            <i className="ri-user-add-line text-4xl sm:text-5xl text-teal-400 mb-4"></i>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">{t.room.setNickname}</h2>
            <p className="text-slate-400 text-sm">{t.room.setNicknameDesc}</p>
          </div>
          <input
            type="text"
            placeholder={t.room.nicknamePlaceholder}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 text-sm"
            maxLength={20}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSetNickname((e.target as HTMLInputElement).value);
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              handleSetNickname(input.value);
            }}
            className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 whitespace-nowrap"
          >
            {t.room.start}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-6xl">
        {/* 방 정보 카드 (생성 시간, 최근 대화 시간) */}
        <div className="mb-3 sm:mb-4 bg-slate-800/50 backdrop-blur-xl rounded-lg p-3 sm:p-4 border border-slate-700/50">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400">
            {roomCreatedAt && (
              <div className="flex items-center gap-1.5">
                <i className="ri-time-line text-teal-400"></i>
                <span className="text-slate-300">
                  {lang === 'ko' ? '생성' : 'Created'}: {roomCreatedAt.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {lastChatAt && (
              <div className="flex items-center gap-1.5">
                <i className="ri-chat-3-line text-cyan-400"></i>
                <span className="text-slate-300">
                  {lang === 'ko' ? '최근 대화' : 'Last Chat'}: {lastChatAt.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {!lastChatAt && roomCreatedAt && (
              <div className="flex items-center gap-1.5">
                <i className="ri-chat-3-line text-slate-500"></i>
                <span className="text-slate-500">
                  {lang === 'ko' ? '아직 대화가 없습니다' : 'No chat yet'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 호스트인 경우 초대 중심 UI */}
        {isHost && (
          <div className="mb-4 sm:mb-6 bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-xl p-4 sm:p-6 border border-green-500/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-green-400 mb-2 sm:mb-3">
                  <i className="ri-group-line mr-2"></i>
                  {lang === 'ko' ? '친구 초대하기' : 'Invite Friends'}
                </h3>
                <div className="bg-slate-900/50 rounded-lg p-3 sm:p-4 border border-slate-700 mb-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <span className="text-xs sm:text-sm text-slate-400 block mb-1">{t.room.roomCode}</span>
                      <div className="font-mono font-bold text-green-400 text-2xl sm:text-3xl lg:text-4xl tracking-wider">
                        {roomCode}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyRoomCode}
                      className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:from-green-700 active:to-emerald-700 text-white font-bold rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50 touch-manipulation active:scale-95 text-sm sm:text-base"
                    >
                      <i className="ri-file-copy-line mr-2"></i>
                      {lang === 'ko' ? '코드 복사' : 'Copy Code'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleShareRoom}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all text-xs sm:text-sm touch-manipulation active:scale-95"
                  >
                    <i className="ri-link mr-1.5"></i>
                    {lang === 'ko' ? '링크 복사' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      const roomUrl = `${window.location.origin}/${lang}/room/${roomCode}`;
                      if (navigator.share) {
                        navigator.share({
                          title: lang === 'ko' ? '바다거북스프 방에 초대합니다' : 'Join my Pelican Soup Riddle room',
                          text: lang === 'ko' ? `방 코드: ${roomCode}` : `Room code: ${roomCode}`,
                          url: roomUrl,
                        }).catch(() => {});
                      } else {
                        handleShareRoom();
                      }
                    }}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all text-xs sm:text-sm touch-manipulation active:scale-95"
                  >
                    <i className="ri-share-line mr-1.5"></i>
                    {lang === 'ko' ? '공유하기' : 'Share'}
                  </button>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 sm:p-4 border border-slate-700 min-w-[120px] sm:min-w-[140px]">
                <div className="text-center">
                  <div className="text-xs sm:text-sm text-slate-400 mb-1">{lang === 'ko' ? '참가자' : 'Players'}</div>
                  <div className="text-2xl sm:text-3xl font-bold text-teal-400">{players.length}</div>
                  <div className="text-xs text-slate-500 mt-1">/ 8</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {!isHost && (
              <div className="bg-slate-800 px-3 sm:px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
                <div>
                  <span className="text-slate-400 text-xs">{t.room.roomCode}</span>
                  <div className="font-mono font-bold text-teal-400 text-base sm:text-lg">{roomCode}</div>
                </div>
                <button
                  onClick={handleCopyRoomCode}
                  className="ml-2 p-1.5 hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
                  title={t.room.copyRoomCode}
                >
                  <i className="ri-file-copy-line text-teal-400 text-sm"></i>
                </button>
                <button
                  onClick={handleShareRoom}
                  className="ml-2 p-1.5 hover:bg-slate-700 rounded-lg transition-colors touch-manipulation"
                  title={t.room.shareRoomLink}
                >
                  <i className="ri-share-line text-teal-400 text-sm"></i>
                </button>
              </div>
            )}
            {isHost && (
              <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 px-3 py-2 rounded-lg border border-teal-500/50">
                <span className="text-teal-400 text-xs font-semibold">
                  <i className="ri-vip-crown-line mr-1"></i>
                  {t.room.host}
                </span>
              </div>
            )}
            {isSpectator && (
              <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-3 py-2 rounded-lg border border-purple-500/50">
                <span className="text-purple-400 text-xs font-semibold">
                  <i className="ri-eye-line mr-1"></i>
                  {t.room.spectatorMode}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLeaveRoom}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-400 border border-red-500/50 rounded-lg transition-all text-xs sm:text-sm font-semibold touch-manipulation active:scale-95 flex items-center gap-1.5"
              title={lang === 'ko' ? '방 나가기' : 'Leave Room'}
            >
              <i className="ri-logout-box-line"></i>
              <span className="hidden sm:inline">{lang === 'ko' ? '나가기' : 'Leave'}</span>
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              gameEnded ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
              {gameEnded ? t.room.ended : t.room.inProgress}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs border ${
              maxQuestions !== null && questions.length >= maxQuestions 
                ? 'bg-orange-500/20 border-orange-500/50' 
                : 'bg-slate-800 border-slate-700'
            }`}>
              <span className={`font-bold ${
                maxQuestions !== null && questions.length >= maxQuestions 
                  ? 'text-orange-400' 
                  : 'text-teal-400'
              }`}>{questions.length}</span>
              <span className="text-slate-500">
                {maxQuestions === null ? ` / ${t.room.unlimited}` : ` / ${maxQuestions}`}
              </span>
            </div>
          </div>
        </div>

        <StoryPanel story={story} lang={lang} />

        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 space-y-4">
            {!isHost && !isSpectator && !gameEnded && (
              <>
                {maxQuestions !== null && questions.length >= maxQuestions ? (
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center bg-orange-500/20 rounded-lg flex-shrink-0">
                        <i className="ri-alert-line text-orange-400 text-sm"></i>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-orange-400 mb-1">{t.room.questionLimitReached}</h3>
                        <p className="text-xs text-slate-300">
                          {lang === 'ko' 
                            ? `최대 질문 개수(${maxQuestions}개)에 도달했습니다. 이제 정답을 추측해보세요!`
                            : `Maximum questions (${maxQuestions}) reached. Now try to guess the answer!`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <QuestionInput onSubmit={handleSubmitQuestion} disabled={maxQuestions !== null && questions.length >= maxQuestions} />
                )}
              </>
            )}
            {isSpectator && (
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 flex items-center justify-center bg-purple-500/20 rounded-lg flex-shrink-0">
                    <i className="ri-eye-line text-purple-400 text-sm"></i>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-purple-400 mb-1">{t.room.spectatorMode}</h3>
                    <p className="text-xs text-slate-300">
                      {t.room.spectatorModeDesc}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <QuestionList
              questions={questions}
              selectedId={selectedQuestionId}
              onSelect={isHost ? setSelectedQuestionId : undefined}
              isHost={isHost}
              lang={lang}
            />

            {isHost && selectedQuestionId && !gameEnded && (
              <HostAnswerButtons
                onAnswer={(answer) => handleAnswerQuestion(selectedQuestionId, answer)}
              />
            )}
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* 참가자 리스트 */}
            {players.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl p-3 sm:p-4 border border-slate-700/50">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3 flex items-center gap-2">
                  <i className="ri-group-line text-teal-400 text-sm sm:text-base"></i>
                  {lang === 'ko' ? '참가자' : 'Players'} ({players.length})
                </h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {players.map((player, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg ${
                        player.is_host
                          ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30'
                          : 'bg-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        {player.is_host && (
                          <i className="ri-vip-crown-line text-yellow-400 text-xs sm:text-sm flex-shrink-0"></i>
                        )}
                        <span className={`text-xs sm:text-sm truncate ${
                          player.is_host ? 'text-teal-400 font-semibold' : 'text-slate-300'
                        }`}>
                          {player.nickname}
                        </span>
                      </div>
                      {player.is_ready && (
                        <div className="flex items-center gap-1 text-green-400 text-xs">
                          <i className="ri-checkbox-circle-fill"></i>
                          <span className="hidden sm:inline">{lang === 'ko' ? '준비완료' : 'Ready'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 준비 완료 버튼 (참가자용) */}
            {!isHost && !isSpectator && !gameEnded && (
              <button
                onClick={async () => {
                  setIsReady(!isReady);
                  // 준비 상태를 서버에 저장 (간단하게 localStorage에 저장)
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`ready_${roomCode}_${nickname}`, String(!isReady));
                  }
                }}
                className={`w-full py-2.5 sm:py-3 rounded-lg font-semibold transition-all duration-200 touch-manipulation active:scale-95 text-xs sm:text-sm ${
                  isReady
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {isReady ? (
                  <>
                    <i className="ri-checkbox-circle-fill mr-2"></i>
                    {lang === 'ko' ? '준비 완료' : 'Ready'}
                  </>
                ) : (
                  <>
                    <i className="ri-checkbox-blank-circle-line mr-2"></i>
                    {lang === 'ko' ? '준비하기' : 'Get Ready'}
                  </>
                )}
              </button>
            )}

            {/* 채팅 패널 */}
            <ChatPanel roomCode={roomCode} nickname={nickname} lang={lang} />

            {!isHost && !isSpectator && !gameEnded && (
              <GuessInput 
                onSubmit={handleSubmitGuess} 
                hasSubmitted={guesses.some(g => g.nickname === nickname)}
                userGuess={guesses.find(g => g.nickname === nickname) || null}
              />
            )}

            {/* 호스트 전용: 게임 종료 버튼 */}
            {(() => {
              console.log('🔍 게임 종료 버튼 체크:', { isHost, gameEnded, nickname });
              return isHost && !gameEnded && (
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/30 mb-4">
                  <button
                    onClick={handleEndGame}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 text-sm sm:text-base touch-manipulation"
                  >
                    <i className="ri-stop-circle-line mr-2"></i>
                    {t.room.endGameButton}
                  </button>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    {t.room.endGameDesc}
                  </p>
                </div>
              );
            })()}

            {isHost && (
              <HostAnswerInbox
                guesses={guesses}
                onJudge={handleJudgeGuess}
                gameEnded={gameEnded}
                lang={lang}
              />
            )}
          </div>
        </div>
      </div>

      {(gameEnded || userWon) && (
        <GameResultModal
          story={story}
          truth={truth}
          questions={questions}
          onRestart={handleRestart}
          roomCode={roomCode}
          lang={lang}
          isUserWon={userWon && !gameEnded}
          onClose={userWon && !gameEnded ? () => setUserWon(false) : undefined}
        />
      )}
    </div>
  );
}
