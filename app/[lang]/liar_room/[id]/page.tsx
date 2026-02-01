'use client';

import { use } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import ChatPanel from '../../room/[code]/ChatPanel';

export default function LiarRoomPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const roomCode = resolvedParams.id;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  
  const [isHost, setIsHost] = useState(false);
  const [gameStatus, setGameStatus] = useState<'LOBBY' | 'PLAYING' | 'FINISHED'>('LOBBY');
  const [roomName, setRoomName] = useState('');
  const [theme, setTheme] = useState('');
  const [level, setLevel] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [players, setPlayers] = useState<Array<{ nickname: string; is_host: boolean; is_ready?: boolean; role?: string; word?: string; eliminated?: boolean; votes_received?: number }>>([]);
  const [myVote, setMyVote] = useState<string | null>(null); // 내가 투표한 플레이어 닉네임
  const [votes, setVotes] = useState<Record<string, number>>({}); // 플레이어별 받은 투표 수
  const [isEliminated, setIsEliminated] = useState(false); // 내가 제외되었는지 여부
  const [gameResult, setGameResult] = useState<'CITIZEN_WIN' | 'LIAR_WIN' | null>(null); // 게임 결과
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomCreatedAt, setRoomCreatedAt] = useState<Date | null>(null);
  const [lastChatAt, setLastChatAt] = useState<Date | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myWord, setMyWord] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [hasSeenRole, setHasSeenRole] = useState(false); // 역할을 이미 확인했는지 여부
  const [gamePhase, setGamePhase] = useState<'LOBBY' | 'ROLE_REVEAL' | 'SPEAKING' | 'VOTING' | 'RESULT'>('LOBBY');
  const [speakingTimeLeft, setSpeakingTimeLeft] = useState<number | null>(null); // 초 단위
  const [speakingTimeMinutes, setSpeakingTimeMinutes] = useState(2); // 발언 시간 (분, 기본값 2분)
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false); // 타이머가 시작되었는지 여부
  const [votingTimeLeft, setVotingTimeLeft] = useState<number | null>(null); // 투표 시간 (초, 15초)
  const [isAdmin, setIsAdmin] = useState(false); // 관리자 여부
  const speakingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const votingTimerRef = useRef<NodeJS.Timeout | null>(null);

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
        const { createClient } = await import('@/lib/supabase/client');
        const supabaseClient = createClient();

        // 관리자 권한 확인 (auth_user_id 사용)
        const { data: gameUser } = await supabaseClient
          .from('game_users')
          .select('is_admin, nickname')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        setIsAdmin(gameUser?.is_admin || false);

        // rooms 테이블에서 호스트 확인
        const { data: roomData } = await supabase
          .from('rooms')
          .select('host_nickname, host_user_id')
          .eq('code', roomCode)
          .single();
        
        // 닉네임: game_users 우선, 없으면 users
        let userNickname = gameUser?.nickname;
        if (!userNickname) {
          const { data: userData } = await supabaseClient
            .from('users')
            .select('nickname')
            .eq('id', user.id)
            .maybeSingle();
          userNickname = userData?.nickname;
        }
        userNickname = roomData?.host_user_id === user.id
          ? (roomData.host_nickname || userNickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'))
          : (userNickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User'));

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

  // 방 참여 함수 (중복 방지: 이미 존재하면 무시)
  const joinRoom = async (playerNickname: string, isHostPlayer: boolean) => {
    try {
      console.log('🚪 방 참여 시도:', { playerNickname, isHostPlayer, roomCode });
      
      // 먼저 이미 존재하는지 확인
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('room_code', roomCode)
        .eq('nickname', playerNickname)
        .maybeSingle();

      // 이미 존재하면 무시
      if (existingPlayer) {
        console.log('✅ 이미 참가자로 등록되어 있음');
        localStorage.setItem(`nickname_${roomCode}`, playerNickname);
        // 참가자 목록 새로고침
        setTimeout(() => loadPlayers(), 500);
        return;
      }

      // 존재하지 않으면 INSERT
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: playerNickname,
          is_host: isHostPlayer,
        });

      if (playerError) {
        // 중복 오류(23505)는 무시 (다른 프로세스에서 이미 추가한 경우)
        if (playerError.code !== '23505') {
          console.error('❌ 플레이어 추가 오류:', playerError);
        } else {
          console.log('⚠️ 중복 참가자 오류 (무시됨)');
        }
      } else {
        console.log('✅ 플레이어 추가 성공');
        // localStorage에 닉네임 저장
        localStorage.setItem(`nickname_${roomCode}`, playerNickname);
      }
      
      // 참가자 목록 새로고침 (약간의 지연 후)
      setTimeout(() => {
        console.log('🔄 참가자 목록 새로고침');
        loadPlayers();
      }, 500);
    } catch (err) {
      console.error('❌ 방 참여 오류:', err);
    }
  };

  // 방 정보 로드
  useEffect(() => {
    const loadRoom = async () => {
      if (!isSupabaseConfigured()) {
        setError(lang === 'ko' 
          ? 'Supabase가 설정되지 않았습니다.'
          : 'Supabase is not configured.');
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
          // 방 이름 설정 (다양한 필드명 확인)
          const name = (room as any).room_name || (room as any).roomName || '';
          setRoomName(name);
          console.log('방 이름 로드:', name, '전체 room:', room);
          setTheme(room.theme || (lang === 'ko' ? '미정' : 'Not set'));
          setLevel(room.level || (lang === 'ko' ? '미정' : 'Not set'));
          setMaxPlayers(room.max_players || 6);
          const status = (room.status as 'LOBBY' | 'PLAYING' | 'FINISHED') || 'LOBBY';
          setGameStatus(status);
          setRoomCreatedAt(room.created_at ? new Date(room.created_at) : null);
          
          // 발언 시간 설정 (DB에서 읽어오거나 기본값 2분)
          const timeMinutes = (room as any).speaking_time_minutes || 2;
          setSpeakingTimeMinutes(timeMinutes);
          
          // 게임이 이미 시작된 경우 역할 확인 (nickname이 있을 때만)
          if (status === 'PLAYING') {
            setGamePhase('SPEAKING');
            // 발언 시간 타이머 시작
            setSpeakingTimeLeft(timeMinutes * 60);
          }
        }
      } catch (err) {
        console.error('방 로드 오류:', err);
        setError(lang === 'ko' ? '방을 불러오는데 실패했습니다.' : 'Failed to load room.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRoom();

    // 실시간으로 방 상태 변경 구독
    const roomChannel = supabase
      .channel(`room-status:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const updatedRoom = payload.new as any;
          const status = (updatedRoom.status as 'LOBBY' | 'PLAYING' | 'FINISHED') || 'LOBBY';
          setGameStatus(status);
          
          // 방 이름 업데이트
          const name = updatedRoom.room_name || updatedRoom.roomName || '';
          if (name) {
            setRoomName(name);
          }
          
          // 발언 시간 업데이트
          if ((updatedRoom as any).speaking_time_minutes) {
            setSpeakingTimeMinutes((updatedRoom as any).speaking_time_minutes);
          }
          
          // 게임이 시작되면 역할 확인
          if (status === 'PLAYING') {
            if (!hasSeenRole) {
              setGamePhase('ROLE_REVEAL');
              // 역할 확인을 약간 지연시켜 DB 업데이트가 완료되도록 함
              setTimeout(() => {
                if (nickname) {
                  checkMyRole();
                }
              }, 300);
            } else {
              setGamePhase('SPEAKING');
              // 타이머 시작 (이미 시작되지 않았을 때만)
              if (!timerStarted && speakingTimeMinutes > 0) {
                setSpeakingTimeLeft(speakingTimeMinutes * 60);
                setTimerStarted(true);
              }
            }
          } else if (status === 'LOBBY') {
            setGamePhase('LOBBY');
            setHasSeenRole(false); // 로비로 돌아가면 리셋
            setTimerStarted(false); // 타이머도 리셋
            setMyRole(null); // 역할도 리셋
            setMyWord(null); // 단어도 리셋
            setSpeakingTimeLeft(null); // 타이머도 리셋
          }
        }
      )
      .subscribe();

    return () => {
      roomChannel.unsubscribe();
    };
  }, [roomCode, lang, nickname, hasSeenRole]);

  // 내 역할 확인
  const checkMyRole = async () => {
    if (!nickname) return;
    
    try {
      const { data: playerData, error } = await supabase
        .from('players')
        .select('role, word')
        .eq('room_code', roomCode)
        .eq('nickname', nickname)
        .single();
      
      if (error) {
        console.error('역할 확인 DB 오류:', error);
        return;
      }
      
      if (playerData) {
        const playerRole = (playerData as any).role || null;
        const playerWord = (playerData as any).word || null;
        
        // 역할이 있고, 아직 설정되지 않았거나 변경된 경우에만 업데이트
        if (playerRole && (myRole !== playerRole || myWord !== playerWord)) {
          console.log('🎭 역할 업데이트:', { playerRole, playerWord, myRole, myWord, hasSeenRole });
          setMyRole(playerRole);
          setMyWord(playerWord);
          // 역할을 처음 받았을 때만 모달 표시
          if (!hasSeenRole && gameStatus === 'PLAYING') {
            setShowRoleModal(true);
            setGamePhase('ROLE_REVEAL');
          }
        } else if (!playerRole && gameStatus === 'PLAYING') {
          // 역할이 아직 배정되지 않은 경우, 잠시 후 다시 확인
          console.log('⏳ 역할이 아직 배정되지 않음, 재시도...');
          setTimeout(() => {
            checkMyRole();
          }, 1000); // 1초 후 재시도
        } else if (playerWord && !myWord && gameStatus === 'PLAYING') {
          // 단어만 업데이트 (역할은 이미 있지만 단어가 없는 경우)
          console.log('📝 단어 업데이트:', playerWord);
          setMyWord(playerWord);
        }
      }
    } catch (err) {
      console.error('역할 확인 오류:', err);
    }
  };

  // nickname이 설정된 후 역할 확인
  useEffect(() => {
    if (nickname && gameStatus === 'PLAYING' && !hasSeenRole) {
      // 역할이 없거나 변경되었을 때 확인
      if (!myRole || (myRole && !myWord && gameStatus === 'PLAYING')) {
        checkMyRole();
      }
    }
  }, [nickname, gameStatus, hasSeenRole]);

  // 참가자 목록 로드 함수 (외부에서도 호출 가능하도록)
  const loadPlayers = useCallback(async () => {
    if (!roomCode) {
      console.warn('⚠️ roomCode가 없어서 참가자 목록을 로드할 수 없습니다.');
      return;
    }

    try {
      console.log('📋 참가자 목록 로드 시작, roomCode:', roomCode);
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('nickname, is_host, role, word, vote_target, eliminated, votes_received')
        .eq('room_code', roomCode);
      
      if (playersError) {
        console.error('❌ 참가자 목록 로드 오류:', playersError);
        return;
      }
      
      console.log('✅ 참가자 목록 로드 성공:', playersData?.length || 0, '명');
      
      if (playersData) {
        setPlayers(playersData.map(p => ({
          nickname: p.nickname,
          is_host: p.is_host,
          is_ready: false,
          role: (p as any).role || null,
          word: (p as any).word || null,
          eliminated: (p as any).eliminated || false,
          votes_received: (p as any).votes_received || 0,
        })));
        
        // 투표 수 실시간 업데이트
        const voteCounts: Record<string, number> = {};
        playersData.forEach(p => {
          const voteTarget = (p as any).vote_target;
          if (voteTarget) {
            voteCounts[voteTarget] = (voteCounts[voteTarget] || 0) + 1;
          }
        });
        setVotes(voteCounts);
        
        // 호스트 상태 업데이트 (내가 호스트인지 확인)
        if (nickname) {
          const myPlayer = playersData.find(p => p.nickname === nickname);
          if (myPlayer) {
            setIsHost(myPlayer.is_host);
            // 내 투표 상태 업데이트
            const myVoteTarget = (myPlayer as any).vote_target;
            if (myVoteTarget && !myVote) {
              setMyVote(myVoteTarget);
            }
            // 제외 상태 업데이트
            const eliminated = (myPlayer as any).eliminated || false;
            if (eliminated !== isEliminated) {
              setIsEliminated(eliminated);
            }
            
            // 내 역할 확인 (게임이 시작되었고 아직 역할을 보지 않았을 때)
            if (gameStatus === 'PLAYING' && !hasSeenRole) {
              const playerRole = (myPlayer as any).role;
              const playerWord = (myPlayer as any).word || null;
              if (playerRole && (myRole !== playerRole || myWord !== playerWord)) {
                console.log('🎭 loadPlayers에서 역할 발견:', { playerRole, playerWord, nickname });
                setMyRole(playerRole);
                setMyWord(playerWord);
                if (!hasSeenRole) {
                  setShowRoleModal(true);
                  setGamePhase('ROLE_REVEAL');
                }
              } else if (playerRole && !myWord && playerWord) {
                // 단어만 업데이트
                console.log('📝 loadPlayers에서 단어 업데이트:', playerWord);
                setMyWord(playerWord);
              }
            }
          }
        }
      } else {
        console.warn('⚠️ 참가자 데이터가 null입니다.');
        setPlayers([]);
      }
    } catch (err) {
      console.error('❌ loadPlayers 예외:', err);
    }
  }, [roomCode, nickname, gameStatus, hasSeenRole, myRole, myWord, myVote, isEliminated]);

  // 참가자 목록 로드 및 실시간 구독
  useEffect(() => {
    if (!roomCode) return;

    loadPlayers();

    // 실시간 구독
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
          console.log('🔄 실시간 구독: 참가자 목록 새로고침');
          await loadPlayers();
        }
      )
      .subscribe();

      return () => {
        playersChannel.unsubscribe();
      };
    }, [roomCode, nickname, gameStatus, hasSeenRole, loadPlayers]);

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

    // 초기 최근 대화 시간 로드
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

  // 투표 결과 처리 (DB에서 최신 투표 집계 후 처리)
  const processVotingResults = useCallback(async () => {
    try {
      const { data: playersData } = await supabase
        .from('players')
        .select('nickname, vote_target, role, eliminated')
        .eq('room_code', roomCode);

      const voteCounts: Record<string, number> = {};
      playersData?.forEach((p: { vote_target?: string }) => {
        const target = p.vote_target;
        if (target) voteCounts[target] = (voteCounts[target] || 0) + 1;
      });

      const maxVotes = Math.max(...Object.values(voteCounts), 0);
      const eliminatedPlayer = Object.entries(voteCounts).find(([, c]) => c === maxVotes)?.[0] ?? null;

      if (!eliminatedPlayer) {
        setGameResult('LIAR_WIN');
        setGamePhase('RESULT');
        setGameStatus('FINISHED');
        await supabase.from('rooms').update({ status: 'FINISHED', game_ended: true }).eq('code', roomCode);
        return;
      }

      await supabase
        .from('players')
        .update({ eliminated: true })
        .eq('room_code', roomCode)
        .eq('nickname', eliminatedPlayer);

      setPlayers(prev => prev.map(p => p.nickname === eliminatedPlayer ? { ...p, eliminated: true } : p));
      setVotes(voteCounts);
      if (eliminatedPlayer === nickname) setIsEliminated(true);

      const eliminatedData = playersData?.find((p: { nickname: string }) => p.nickname === eliminatedPlayer);
      const wasLiar = (eliminatedData as { role?: string })?.role === 'LIAR';
      const remainingLiars = (playersData || []).filter(
        (p: { nickname: string; role?: string }) => p.role === 'LIAR' && p.nickname !== eliminatedPlayer
      ).length;

      if (wasLiar && remainingLiars === 0) {
        setGameResult('CITIZEN_WIN');
      } else {
        setGameResult(remainingLiars > 0 ? 'LIAR_WIN' : 'CITIZEN_WIN');
      }
      setGamePhase('RESULT');
      setGameStatus('FINISHED');
      await supabase.from('rooms').update({ status: 'FINISHED', game_ended: true }).eq('code', roomCode);
    } catch (error) {
      console.error('투표 결과 처리 오류:', error);
    }
  }, [nickname, roomCode]);

  // 발언 시간 타이머
  useEffect(() => {
    if (gamePhase !== 'SPEAKING') return;
    if (speakingTimerRef.current) clearInterval(speakingTimerRef.current);
    speakingTimerRef.current = setInterval(() => {
      setSpeakingTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (speakingTimerRef.current) {
            clearInterval(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          setGamePhase('VOTING');
          setVotingTimeLeft(15);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (speakingTimerRef.current) {
        clearInterval(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [gamePhase]);

  // 투표 시간 타이머
  useEffect(() => {
    if (gamePhase !== 'VOTING') return;
    if (votingTimerRef.current) clearInterval(votingTimerRef.current);
    votingTimerRef.current = setInterval(() => {
      setVotingTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (votingTimerRef.current) {
            clearInterval(votingTimerRef.current);
            votingTimerRef.current = null;
          }
          processVotingResults();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (votingTimerRef.current) {
        clearInterval(votingTimerRef.current);
        votingTimerRef.current = null;
      }
    };
  }, [gamePhase, processVotingResults]);

  // 투표 처리
  const handleVote = async (targetNickname: string) => {
    if (!nickname || myVote || isEliminated) return;

    try {
      // DB에 투표 저장
      const { error: voteError } = await supabase
        .from('players')
        .update({ 
          vote_target: targetNickname 
        })
        .eq('room_code', roomCode)
        .eq('nickname', nickname);

      if (voteError) {
        console.error('투표 저장 오류:', voteError);
        return;
      }

      // 로컬 상태 업데이트
      setMyVote(targetNickname);
      
      // 투표 수 업데이트 (실시간으로 반영)
      setVotes(prev => ({
        ...prev,
        [targetNickname]: (prev[targetNickname] || 0) + 1
      }));
    } catch (error) {
      console.error('투표 오류:', error);
    }
  };

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
      ? (lang === 'ko' 
          ? '호스트로 나가시면 방이 종료됩니다. 정말 나가시겠습니까?' 
          : 'Leaving as host will end the room. Are you sure?')
      : (lang === 'ko' 
          ? '방에서 나가시겠습니까?' 
          : 'Are you sure you want to leave the room?');
    
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
        // 에러가 발생해도 계속 진행 (이미 나간 경우 등)
      }

      // 2. 호스트인 경우 방 종료
      if (isHost) {
        const { error: updateError } = await supabase
          .from('rooms')
          .update({ 
            status: 'FINISHED',
            game_ended: true 
          })
          .eq('code', roomCode);

        if (updateError) {
          console.error('방 종료 오류:', updateError);
          // 에러가 발생해도 계속 진행
        }
      }

      // 3. localStorage에서 닉네임 및 관련 정보 삭제
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`nickname_${roomCode}`);
        localStorage.removeItem(`roomCode_${roomCode}`);
      }

      // 4. 방 목록으로 리다이렉트
      router.push(`/${lang}/rooms`);
    } catch (error: any) {
      console.error('방 나가기 오류:', error);
      // 에러 메시지를 더 구체적으로 표시
      const errorMessage = error?.message || (lang === 'ko' ? '방 나가기에 실패했습니다.' : 'Failed to leave room.');
      if (typeof window !== 'undefined' && (window as any).toastError) {
        (window as any).toastError(errorMessage);
      } else {
        alert(errorMessage);
      }
    }
  };

  const handleStartGame = async () => {
    if (!isHost || players.length < 3) {
      alert(lang === 'ko' 
        ? '최소 3명 이상 모여야 게임을 시작할 수 있습니다.'
        : 'At least 3 players are required to start the game.');
      return;
    }

    try {
      // 1. 각 플레이어에게 역할과 단어 배정
      const playerList = players.map(p => p.nickname);
      const actualPlayerCount = playerList.length;
      
      // 실제 시작 인원에 따라 라이어 수 자동 계산
      let actualLiarCount: number;
      if (actualPlayerCount <= 5) {
        actualLiarCount = 1;
      } else if (actualPlayerCount <= 9) {
        actualLiarCount = 2;
      } else {
        actualLiarCount = 3;
      }
      
      // 최소 1명은 시민이어야 함
      actualLiarCount = Math.min(actualLiarCount, actualPlayerCount - 1);
      
      // 라이어 선정
      const liarIndices: number[] = [];
      const availableIndices = [...Array(playerList.length).keys()];
      
      for (let i = 0; i < actualLiarCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableIndices.length);
        liarIndices.push(availableIndices[randomIndex]);
        availableIndices.splice(randomIndex, 1);
      }
      
      // 주제에 맞는 단어 선택
      const { getRandomWord } = await import('@/lib/utils/liar-game');
      const selectedWord = getRandomWord(theme as any);
      
      // 각 플레이어에게 역할과 단어 배정
      const roleAssignments = await Promise.all(
        playerList.map(async (playerNickname, index) => {
          const isLiar = liarIndices.includes(index);
          const role = isLiar ? 'LIAR' : 'CITIZEN';
          const word = isLiar ? null : selectedWord;
          
          // players 테이블 업데이트 (role과 word 필드가 있다고 가정)
          const { error } = await supabase
            .from('players')
            .update({ 
              role: role,
              word: word,
            })
            .eq('room_code', roomCode)
            .eq('nickname', playerNickname);
          
          if (error) {
            console.error(`플레이어 ${playerNickname} 역할 배정 오류:`, error);
          }
          
          return { nickname: playerNickname, role, word };
        })
      );
      
      // 2. 방 상태를 PLAYING으로 변경
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'PLAYING' })
        .eq('code', roomCode);
      
      if (roomError) throw roomError;
      
      setGameStatus('PLAYING');
      setGamePhase('ROLE_REVEAL');
      
      // 3. 내 역할 확인 (실시간 구독으로도 처리되지만 즉시 표시)
      if (nickname) {
        const myAssignment = roleAssignments.find(a => a.nickname === nickname);
        if (myAssignment) {
          setMyRole(myAssignment.role);
          setMyWord(myAssignment.word || null);
          setShowRoleModal(true);
        }
      }
      
      // 4. 플레이어 목록 새로고침 (역할 정보 포함)
      const { data: updatedPlayers } = await supabase
        .from('players')
        .select('nickname, is_host, role, word')
        .eq('room_code', roomCode);
      
      if (updatedPlayers) {
        setPlayers(updatedPlayers.map(p => ({
          nickname: p.nickname,
          is_host: p.is_host,
          is_ready: false,
          role: (p as any).role || null,
          word: (p as any).word || null,
        })));
      }
    } catch (error) {
      console.error('게임 시작 오류:', error);
      alert(lang === 'ko' ? '게임 시작에 실패했습니다.' : 'Failed to start game.');
    }
  };

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert(lang === 'ko' ? '방 코드가 복사되었습니다.' : 'Room code copied.');
    } catch (err) {
      alert(lang === 'ko' ? '복사에 실패했습니다.' : 'Failed to copy.');
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

  // Warm Gray + Olive 색상 테마
  const bgColor = '#0E0D0B';
  const surfaceColor = '#171614';
  const borderColor = '#2A2824';
  const textPrimary = '#F1F0ED';
  const textSecondary = '#A8A29E';
  const accentColor = '#A3B18A';
  const accentHover = '#7F8F69';

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, color: textPrimary }}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/${lang}`}>
            <button 
              className="transition-colors whitespace-nowrap text-sm sm:text-base"
              style={{ color: textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.color = textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = textSecondary}
            >
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleDeleteRoom}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white border border-red-700 rounded-lg transition-all text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                title={lang === 'ko' ? '방 삭제 (관리자 전용)' : 'Delete Room (Admin Only)'}
              >
                <i className="ri-delete-bin-line"></i>
                <span className="hidden sm:inline">{lang === 'ko' ? '방 삭제' : 'Delete'}</span>
              </button>
            )}
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

        {/* 방 정보 */}
        <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
          <h1 className="text-xl sm:text-2xl font-bold mb-2" style={{ color: accentColor }}>
            {roomName || (lang === 'ko' ? '라이어 게임' : 'Liar Game')}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm" style={{ color: textSecondary }}>
            <div>
              <span className="mr-1">{lang === 'ko' ? '주제' : 'Theme'}:</span>
              <span style={{ color: textPrimary }}>{theme || (lang === 'ko' ? '미정' : 'Not set')}</span>
            </div>
            <div>
              <span className="mr-1">{lang === 'ko' ? '난이도' : 'Difficulty'}:</span>
              <span style={{ color: textPrimary }}>{level || (lang === 'ko' ? '미정' : 'Not set')}</span>
            </div>
            <div>
              <span className="mr-1">{lang === 'ko' ? '인원' : 'Players'}:</span>
              <span style={{ color: textPrimary }}>{players.length} / {maxPlayers}</span>
            </div>
          </div>
        </div>

        {/* 게임 상태에 따른 UI */}
        {gameStatus === 'LOBBY' && (
          <div className="space-y-4">
            {/* 안내 메시지 */}
            <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
              <p className="text-sm" style={{ color: textSecondary }}>
                {lang === 'ko' 
                  ? '최소 3명 이상 모이면 시작할 수 있습니다. 대화를 나누며 대기해주세요.'
                  : 'At least 3 players are required to start. Please wait and chat.'}
              </p>
            </div>

            {/* 참가자 목록 */}
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
                      player.is_host
                        ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30'
                        : 'bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {player.is_host && (
                        <i className="ri-vip-crown-line text-yellow-400"></i>
                      )}
                      <span className={`text-sm ${
                        player.is_host ? 'text-teal-400 font-semibold' : 'text-slate-300'
                      }`}>
                        {player.nickname}
                      </span>
                    </div>
                    {player.is_ready ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <i className="ri-checkbox-circle-fill"></i>
                        <span>{lang === 'ko' ? '준비완료' : 'Ready'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-yellow-400 text-xs">
                        <i className="ri-time-line"></i>
                        <span>{lang === 'ko' ? '준비중' : 'Preparing'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 호스트 전용: 시작 버튼 */}
            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={players.length < 3}
                className="w-full py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: players.length < 3
                    ? `${accentColor}50`
                    : `linear-gradient(to right, ${accentColor}, ${accentHover})`,
                  color: bgColor,
                }}
              >
                <i className="ri-play-line mr-2"></i>
                {lang === 'ko' ? '게임 시작' : 'Start Game'}
              </button>
            )}

            {/* 채팅 패널 */}
            {nickname && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                  <i className="ri-chat-3-line mr-2"></i>
                  {lang === 'ko' ? '대화' : 'Chat'}
                </h3>
                <ChatPanel roomCode={roomCode} nickname={nickname} lang={lang} title={lang === 'ko' ? '대화' : 'Chat'} />
              </div>
            )}
          </div>
        )}

        {gameStatus === 'PLAYING' && (
          <div className="space-y-4">
            {gamePhase === 'ROLE_REVEAL' && (
              <div className="p-6 rounded-xl border text-center" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                <h2 className="text-2xl font-bold mb-4" style={{ color: accentColor }}>
                  {lang === 'ko' ? '게임 시작!' : 'Game Started!'}
                </h2>
                {myRole === 'LIAR' ? (
                  <div>
                    <p className="text-xl font-semibold mb-2" style={{ color: '#F87171' }}>
                      {lang === 'ko' ? '당신은 라이어입니다!' : 'You are the LIAR!'}
                    </p>
                    <p className="text-sm" style={{ color: textSecondary }}>
                      {lang === 'ko' 
                        ? '다른 플레이어들이 말하는 단어를 추측하고, 라이어임을 들키지 않도록 하세요.'
                        : 'Guess the word from other players and don\'t let them know you\'re the liar.'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-semibold mb-2" style={{ color: accentColor }}>
                      {lang === 'ko' ? '당신의 단어' : 'Your Word'}
                    </p>
                    <p className="text-3xl font-bold mb-4" style={{ color: textPrimary }}>
                      {myWord || '-'}
                    </p>
                    <p className="text-sm" style={{ color: textSecondary }}>
                      {lang === 'ko' 
                        ? '라이어를 찾아내세요! 다른 플레이어들에게 이 단어에 대해 말하되, 라이어에게는 단어를 직접 말하지 마세요.'
                        : 'Find the liar! Talk about this word to other players, but don\'t say the word directly to the liar.'}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setHasSeenRole(true); // 역할 확인 완료
                    setGamePhase('SPEAKING');
                    // 발언 시간 타이머 시작 - 한 번만 시작
                    if (!timerStarted) {
                      setSpeakingTimeLeft(speakingTimeMinutes * 60);
                      setTimerStarted(true);
                    }
                  }}
                  className="mt-6 px-6 py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    background: `linear-gradient(to right, ${accentColor}, ${accentHover})`,
                    color: bgColor,
                  }}
                >
                  {lang === 'ko' ? '확인' : 'OK'}
                </button>
              </div>
            )}
            
            {gamePhase === 'SPEAKING' && (
              <div className="space-y-4">
                {/* 내 단어 표시 */}
                {myRole && (
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: accentColor + '20', borderColor: accentColor + '50' }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold" style={{ color: accentColor }}>
                        <i className="ri-file-text-line mr-2"></i>
                        {myRole === 'LIAR' ? (lang === 'ko' ? '당신의 역할' : 'Your Role') : (lang === 'ko' ? '내 단어' : 'My Word')}
                      </h3>
                      {speakingTimeLeft !== null && (
                        <div className="text-lg font-bold" style={{ color: speakingTimeLeft <= 10 ? '#F87171' : accentColor }}>
                          {Math.floor(speakingTimeLeft / 60)}:{(speakingTimeLeft % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-center py-2" style={{ color: textPrimary }}>
                      {myRole === 'LIAR' ? (lang === 'ko' ? '당신은 라이어입니다' : 'You are the LIAR') : (myWord || (lang === 'ko' ? '로딩 중...' : 'Loading...'))}
                    </div>
                    {myRole === 'LIAR' ? (
                      <p className="text-xs text-center mt-2" style={{ color: textSecondary }}>
                        {lang === 'ko' ? '다른 사람들의 단어를 듣고 자연스럽게 이야기하세요.' : 'Listen to others and speak naturally.'}
                      </p>
                    ) : (
                      <p className="text-xs text-center mt-2" style={{ color: textSecondary }}>
                        {lang === 'ko' ? '이 단어에 대해 이야기하세요. 라이어를 찾아내세요!' : 'Talk about this word. Find the liar!'}
                      </p>
                    )}
                  </div>
                )}

                {/* 발언 시간 안내 */}
                <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: textPrimary }}>
                    <i className="ri-time-line mr-2"></i>
                    {lang === 'ko' ? '발언 시간' : 'Speaking Time'}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: textSecondary }}>
                    {lang === 'ko' 
                      ? '각자 차례대로 단어에 대해 이야기해주세요. 라이어를 찾아내세요!'
                      : 'Take turns talking about the word. Find the liar!'}
                  </p>
                  {nickname && (
                    <ChatPanel 
                      roomCode={roomCode} 
                      nickname={nickname} 
                      lang={lang} 
                      title={lang === 'ko' ? '게임 대화' : 'Game Chat'}
                      gamePhase={gamePhase}
                    />
                  )}
                </div>
              </div>
            )}
            
            {/* 투표 단계 */}
            {gamePhase === 'VOTING' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: accentColor + '20', borderColor: accentColor + '50' }}>
                  <h2 className="text-xl font-bold mb-2" style={{ color: accentColor }}>
                    {lang === 'ko' ? '투표 시간' : 'Voting Time'}
                  </h2>
                  {votingTimeLeft !== null && (
                    <div className="text-2xl font-bold mb-2" style={{ color: votingTimeLeft <= 5 ? '#F87171' : accentColor }}>
                      {votingTimeLeft}초
                    </div>
                  )}
                  <p className="text-sm" style={{ color: textSecondary }}>
                    {lang === 'ko' 
                      ? '라이어라고 생각하는 사람에게 투표하세요!' 
                      : 'Vote for who you think is the liar!'}
                  </p>
                </div>

                {/* 투표 대상 목록 */}
                {!isEliminated && (
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: textPrimary }}>
                      {lang === 'ko' ? '투표할 플레이어 선택' : 'Select Player to Vote'}
                    </h3>
                    <div className="space-y-2">
                      {players
                        .filter(p => p.nickname !== nickname && !p.eliminated)
                        .map((player) => (
                          <button
                            key={player.nickname}
                            onClick={() => handleVote(player.nickname)}
                            disabled={!!myVote}
                            className={`w-full p-3 rounded-lg text-left transition-all ${
                              myVote === player.nickname
                                ? 'ring-2 ring-offset-2'
                                : 'hover:opacity-80'
                            }`}
                            style={{
                              backgroundColor: myVote === player.nickname ? accentColor + '30' : surfaceColor,
                              borderColor: myVote === player.nickname ? accentColor : borderColor,
                              borderWidth: '1px',
                              color: textPrimary,
                              opacity: myVote && myVote !== player.nickname ? 0.5 : 1,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{player.nickname}</span>
                              {myVote === player.nickname && (
                                <i className="ri-check-line text-lg" style={{ color: accentColor }}></i>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                    {myVote && (
                      <p className="text-sm mt-4 text-center" style={{ color: textSecondary }}>
                        {lang === 'ko' 
                          ? `✅ ${myVote}님에게 투표했습니다. 결과를 기다려주세요.`
                          : `✅ Voted for ${myVote}. Waiting for results...`}
                      </p>
                    )}
                  </div>
                )}

                {/* 관전 모드 (제외된 플레이어) */}
                {isEliminated && (
                  <div className="p-4 rounded-xl border" style={{ backgroundColor: '#F87171' + '20', borderColor: '#F87171' + '50' }}>
                    <h3 className="text-lg font-semibold mb-2 text-center" style={{ color: '#F87171' }}>
                      {lang === 'ko' ? '관전 모드' : 'Spectator Mode'}
                    </h3>
                    <p className="text-sm text-center" style={{ color: textSecondary }}>
                      {lang === 'ko' 
                        ? '당신은 제외되었습니다. 다른 플레이어들의 투표 결과를 지켜보세요.'
                        : 'You have been eliminated. Watch the voting results.'}
                    </p>
                  </div>
                )}

                {/* 투표 현황 (실시간 업데이트) */}
                <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: textPrimary }}>
                    <i className="ri-bar-chart-line mr-2"></i>
                    {lang === 'ko' ? '투표 현황' : 'Voting Status'}
                  </h3>
                  <div className="space-y-2">
                    {players
                      .filter(p => !p.eliminated)
                      .map((player) => {
                        const voteCount = votes[player.nickname] || 0;
                        return (
                          <div
                            key={player.nickname}
                            className="flex items-center justify-between p-3 rounded-lg transition-all"
                            style={{ 
                              backgroundColor: voteCount > 0 ? accentColor + '10' : surfaceColor, 
                              borderColor: voteCount > 0 ? accentColor + '30' : borderColor, 
                              borderWidth: '1px' 
                            }}
                          >
                            <span className="text-sm font-medium" style={{ color: textPrimary }}>
                              {player.nickname}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold" style={{ color: accentColor }}>
                                {voteCount} {lang === 'ko' ? '표' : 'votes'}
                              </span>
                              {voteCount > 0 && (
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }}></div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* 채팅 */}
                {nickname && (
                  <ChatPanel 
                    roomCode={roomCode} 
                    nickname={nickname} 
                    lang={lang} 
                    title={lang === 'ko' ? '게임 대화' : 'Game Chat'}
                    gamePhase={gamePhase}
                  />
                )}
              </div>
            )}

            {/* 게임 결과 */}
            {gamePhase === 'RESULT' && (
              <div className="space-y-4">
                <div className={`p-6 rounded-xl border text-center ${
                  gameResult === 'CITIZEN_WIN' 
                    ? 'bg-green-500/20 border-green-500/50' 
                    : 'bg-red-500/20 border-red-500/50'
                }`}>
                  <h2 className="text-2xl font-bold mb-4" style={{ 
                    color: gameResult === 'CITIZEN_WIN' ? '#10B981' : '#F87171' 
                  }}>
                    {gameResult === 'CITIZEN_WIN' 
                      ? (lang === 'ko' ? '🎉 시민 승리!' : '🎉 Citizens Win!')
                      : (lang === 'ko' ? '😈 라이어 승리!' : '😈 Liar Wins!')}
                  </h2>
                  {gameResult === 'CITIZEN_WIN' && (
                    <p className="text-lg mb-2" style={{ color: textPrimary }}>
                      {lang === 'ko' ? '라이어를 모두 잡았습니다!' : 'All liars have been caught!'}
                    </p>
                  )}
                  <p className="text-sm" style={{ color: textSecondary }}>
                    {lang === 'ko' 
                      ? '게임 결과를 확인하고 방에서 나가거나 계속 잡담할 수 있습니다.'
                      : 'Check the game results and leave the room or continue chatting.'}
                  </p>
                </div>

                {/* 플레이어 역할 공개 */}
                <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: textPrimary }}>
                    {lang === 'ko' ? '플레이어 역할' : 'Player Roles'}
                  </h3>
                  <div className="space-y-2">
                    {players.map((player) => (
                      <div
                        key={player.nickname}
                        className="flex items-center justify-between p-2 rounded-lg"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor, borderWidth: '1px' }}
                      >
                        <span className="text-sm" style={{ color: textPrimary }}>
                          {player.nickname}
                        </span>
                        <span className={`text-sm font-bold ${
                          player.role === 'LIAR' ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {player.role === 'LIAR' 
                            ? (lang === 'ko' ? '라이어' : 'LIAR')
                            : (lang === 'ko' ? '시민' : 'CITIZEN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 잡담방만 표시 (게임 종료 후) */}
                {nickname && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                      <i className="ri-chat-3-line mr-2"></i>
                      {lang === 'ko' ? '잡담' : 'Chat'}
                    </h3>
                    <ChatPanel 
                      roomCode={roomCode} 
                      nickname={nickname} 
                      lang={lang} 
                      title={lang === 'ko' ? '잡담' : 'Chat'}
                      gamePhase="LOBBY"
                    />
                  </div>
                )}
                
                {/* 방 나가기 버튼 */}
                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-3 rounded-xl font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: surfaceColor,
                    borderColor: borderColor,
                    borderWidth: '1px',
                    color: textPrimary,
                  }}
                >
                  {lang === 'ko' ? '방 나가기' : 'Leave Room'}
                </button>
              </div>
            )}

            {gamePhase !== 'ROLE_REVEAL' && gamePhase !== 'SPEAKING' && gamePhase !== 'VOTING' && gamePhase !== 'RESULT' && (
              <div className="p-4 rounded-xl border" style={{ backgroundColor: surfaceColor, borderColor: borderColor }}>
                <p className="text-center text-sm" style={{ color: textSecondary }}>
                  {lang === 'ko' ? '게임 진행 중...' : 'Game in progress...'}
                </p>
              </div>
            )}
          </div>
        )}

        {gameStatus === 'FINISHED' && (
          <div className="space-y-4">
            {/* 잡담방만 표시 */}
            {nickname && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: textPrimary }}>
                  <i className="ri-chat-3-line mr-2"></i>
                  {lang === 'ko' ? '잡담' : 'Chat'}
                </h3>
                <ChatPanel 
                  roomCode={roomCode} 
                  nickname={nickname} 
                  lang={lang} 
                  title={lang === 'ko' ? '잡담' : 'Chat'}
                  gamePhase="LOBBY"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

