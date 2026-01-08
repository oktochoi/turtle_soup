'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Question, Guess, Room } from '@/lib/types';
import StoryPanel from './StoryPanel';
import QuestionInput from './QuestionInput';
import QuestionList from './QuestionList';
import HostAnswerButtons from './HostAnswerButtons';
import GuessInput from './GuessInput';
import HostAnswerInbox from './HostAnswerInbox';
import GameResultModal from './GameResultModal';

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

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.code;
  const router = useRouter();
  
  const [isHost, setIsHost] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [userWon, setUserWon] = useState(false); // 정답 맞춘 유저만 개인적으로 종료
  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [maxQuestions, setMaxQuestions] = useState<number | null>(30);
  const [questions, setQuestions] = useState<LocalQuestion[]>([]);
  const [guesses, setGuesses] = useState<LocalGuess[]>([]);
  const [players, setPlayers] = useState<Array<{ nickname: string; is_host: boolean }>>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [showNicknameModal, setShowNicknameModal] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Supabase에서 방 정보 로드
  useEffect(() => {
    const loadRoom = async () => {
      // Supabase 환경 변수 확인
      if (!isSupabaseConfigured()) {
        setError('Supabase가 설정되지 않았습니다.\n\n.env.local 파일을 확인하고 개발 서버를 재시작하세요.');
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
            setStory('게임이 종료되었습니다');
            setTruth('게임이 종료되었습니다');
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
        }
      } catch (err) {
        console.error('방 로드 오류:', err);
        setError('방 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRoom();
  }, [roomCode]);

  // URL 파라미터에서 호스트 여부와 닉네임 확인, localStorage에서 닉네임 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hostParam = urlParams.get('host') === 'true';
      const nicknameParam = urlParams.get('nickname');
      
      setIsHost(hostParam);
      
      // localStorage에서 저장된 닉네임 확인 (같은 방 코드인 경우만)
      const savedNickname = localStorage.getItem(`nickname_${roomCode}`);
      const savedRoomCode = localStorage.getItem(`roomCode_${roomCode}`);
      
      if (nicknameParam) {
        // URL 파라미터가 있으면 우선 사용
        const decodedNickname = decodeURIComponent(nicknameParam);
        setNickname(decodedNickname);
        setShowNicknameModal(false);
        // localStorage에 저장
        localStorage.setItem(`nickname_${roomCode}`, decodedNickname);
        localStorage.setItem(`roomCode_${roomCode}`, roomCode);
        joinRoom(decodedNickname, hostParam);
      } else if (savedNickname && savedRoomCode === roomCode) {
        // localStorage에 저장된 닉네임이 있고 같은 방이면 사용
        console.log('💾 저장된 닉네임 불러오기:', savedNickname);
        setNickname(savedNickname);
        setShowNicknameModal(false);
        joinRoom(savedNickname, hostParam);
      }
      // 둘 다 없으면 닉네임 모달 표시
    }
  }, [roomCode]);

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

        const [questionsRes, guessesRes, playersRes] = await Promise.all([
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
          })));
        }
      } catch (err) {
        console.error('초기 데이터 로드 오류:', err);
      }
    };

    loadInitialData();

    // 주기적으로 방 상태 확인 (Polling) - Realtime이 작동하지 않을 경우를 대비
    const pollRoomStatus = async () => {
      try {
        const { data: roomData, error } = await supabase
          .from('rooms')
          .select('status, game_ended')
          .eq('code', roomCode)
          .single();
        
        if (error) {
          // 방을 찾을 수 없으면 삭제된 것으로 간주 (게임 종료됨)
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            console.log('🔄 Polling: 방이 삭제되었습니다 - 게임 종료 상태로 간주');
            setGameEnded(true);
            return;
          }
          console.error('방 상태 확인 오류:', error);
          return;
        }
        
        if (roomData) {
          if (roomData.status === 'done' || roomData.game_ended) {
            console.log('🔄 Polling: 게임 종료 상태 감지 - 모든 사용자에게 모달 표시');
            setGameEnded(true);
          }
        } else {
          // 방 데이터가 없으면 삭제된 것으로 간주
          console.log('🔄 Polling: 방 데이터가 없습니다 - 게임 종료 상태로 간주');
          setGameEnded(true);
        }
      } catch (err) {
        console.error('방 상태 Polling 오류:', err);
        // 오류 발생 시에도 게임 종료로 간주 (방이 삭제되었을 가능성)
        setGameEnded(true);
      }
    };

    // 2초마다 방 상태 확인
    const pollInterval = setInterval(pollRoomStatus, 2000);

    return () => {
      questionsChannel.unsubscribe();
      guessesChannel.unsubscribe();
      roomChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [roomCode, showNicknameModal]);

  const handleSubmitQuestion = async (text: string) => {
    if (!text.trim() || gameEnded || !nickname) return;

    // 최대 질문 개수 체크 (무제한이 아닐 때만)
    if (maxQuestions !== null && questions.length >= maxQuestions) {
      alert(`최대 질문 개수(${maxQuestions}개)에 도달했습니다. 더 이상 질문할 수 없습니다.`);
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
      alert('질문 제출에 실패했습니다.');
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
      alert('답변 제출에 실패했습니다.');
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
      alert('추측 제출에 실패했습니다.');
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
      alert('추측 판정에 실패했습니다.');
    }
  };

  // 호스트가 게임 종료 버튼을 눌러 전체 공개
  const handleEndGame = async () => {
    if (!isHost) return;

    if (!confirm('게임을 종료하시겠습니까? 종료하면 모든 데이터가 삭제됩니다.')) {
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
      alert('게임 종료 중 오류가 발생했습니다.');
    }
  };

  // 방 코드 복사
  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert('방 코드가 복사되었습니다!');
    } catch (err) {
      // 복사 실패 시 대체 방법
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('방 코드가 복사되었습니다!');
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
    
    // 방 참여
    await joinRoom(trimmedName, false);
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
      alert('게임 재시작에 실패했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">방 정보를 불러오는 중...</p>
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
            onClick={() => router.push('/')}
            className="mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
          >
            홈으로 돌아가기
          </button>
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
            <h2 className="text-xl sm:text-2xl font-bold mb-2">닉네임 설정</h2>
            <p className="text-slate-400 text-sm">게임에 사용할 닉네임을 입력하세요</p>
          </div>
          <input
            type="text"
            placeholder="닉네임 입력"
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
            시작하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-3 sm:px-4 py-4 max-w-6xl">
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-slate-800 px-3 sm:px-4 py-2 rounded-lg border border-slate-700 flex items-center gap-2">
              <div>
              <span className="text-slate-400 text-xs">방 코드</span>
                <div className="font-mono font-bold text-teal-400 text-base sm:text-lg">{roomCode}</div>
              </div>
              <button
                onClick={handleCopyRoomCode}
                className="ml-2 p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                title="방 코드 복사"
              >
                <i className="ri-file-copy-line text-teal-400 text-sm"></i>
              </button>
            </div>
            {isHost && (
              <div className="bg-gradient-to-r from-teal-500/20 to-cyan-500/20 px-3 py-2 rounded-lg border border-teal-500/50">
                <span className="text-teal-400 text-xs font-semibold">
                  <i className="ri-vip-crown-line mr-1"></i>
                  관리자
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              gameEnded ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
              {gameEnded ? '종료' : '진행중'}
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
                {maxQuestions === null ? ' / 무제한' : ` / ${maxQuestions}`}
              </span>
            </div>
          </div>
        </div>

        <StoryPanel story={story} />

        <div className="grid lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2 space-y-4">
            {!isHost && !gameEnded && (
              <>
                {maxQuestions !== null && questions.length >= maxQuestions ? (
                  <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/30">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center bg-orange-500/20 rounded-lg flex-shrink-0">
                        <i className="ri-alert-line text-orange-400 text-sm"></i>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-orange-400 mb-1">질문 제한 도달</h3>
                        <p className="text-xs text-slate-300">
                          최대 질문 개수({maxQuestions}개)에 도달했습니다. 이제 정답을 추측해보세요!
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <QuestionInput onSubmit={handleSubmitQuestion} disabled={maxQuestions !== null && questions.length >= maxQuestions} />
                )}
              </>
            )}
            
            <QuestionList
              questions={questions}
              selectedId={selectedQuestionId}
              onSelect={isHost ? setSelectedQuestionId : undefined}
              isHost={isHost}
            />

            {isHost && selectedQuestionId && !gameEnded && (
              <HostAnswerButtons
                onAnswer={(answer) => handleAnswerQuestion(selectedQuestionId, answer)}
              />
            )}
          </div>

          <div className="space-y-4">
            {!isHost && !gameEnded && (
              <GuessInput 
                onSubmit={handleSubmitGuess} 
                hasSubmitted={guesses.some(g => g.nickname === nickname)}
                userGuess={guesses.find(g => g.nickname === nickname) || null}
              />
            )}

            {isHost && (
              <>
                {!gameEnded && (
                  <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/30">
                    <button
                      onClick={handleEndGame}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 text-sm sm:text-base"
                    >
                      <i className="ri-stop-circle-line mr-2"></i>
                      게임 종료 (전체 공개)
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      게임을 종료하면 모든 참여자에게 진실이 공개됩니다
                    </p>
                  </div>
                )}
              <HostAnswerInbox
                guesses={guesses}
                onJudge={handleJudgeGuess}
                gameEnded={gameEnded}
              />
              </>
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
          isUserWon={userWon && !gameEnded}
          onClose={userWon && !gameEnded ? () => setUserWon(false) : undefined}
        />
      )}
    </div>
  );
}
