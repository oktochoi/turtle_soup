'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { QuizType } from '@/lib/types/quiz';
import QuizTypeSelectorMultiplayer from '@/components/quiz/QuizTypeSelectorMultiplayer';

type Theme = '음식' | '동물' | '장소' | '직업' | '물건' | '영화/드라마' | '스포츠' | '랜덤';
type Level = 'EASY' | 'NORMAL' | 'HARD';

const THEMES: Theme[] = ['음식', '동물', '장소', '직업', '물건', '영화/드라마', '스포츠', '랜덤'];
const LEVELS: { value: Level; label: string; description: string }[] = [
  { value: 'EASY', label: '초보', description: '단어 흔함, 추리 쉬움' },
  { value: 'NORMAL', label: '기본', description: '일반적인 난이도' },
  { value: 'HARD', label: '어려움', description: '단어 비유/추리 난이도 높음' },
];

export default function CreateRoom({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const t = useTranslations();
  
  // 게임 타입
  const [quizType, setQuizType] = useState<QuizType | null>(null);
  
  // 라이어 게임용 필드
  const [roomName, setRoomName] = useState('');
  const [theme, setTheme] = useState<Theme | ''>('');
  const [level, setLevel] = useState<Level>('NORMAL');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [speakingTimeMinutes, setSpeakingTimeMinutes] = useState(2); // 발언 시간 (1~3분)
  
  // 바다거북스프/마피아용 필드
  const [story, setStory] = useState('');
  const [truth, setTruth] = useState('');
  const [maxQuestions, setMaxQuestions] = useState(30);
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  
  // 수다방(잡담방)용 필드
  const [chatRoomName, setChatRoomName] = useState('');
  const [chatMaxMembers, setChatMaxMembers] = useState(50);
  
  // 상태
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (!authLoading && !user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      router.push(`/${lang}/auth/login`);
    }
  }, [user, authLoading, router, lang]);

  // 게임 타입에 따른 색상 테마
  const getThemeColors = (type: QuizType | null) => {
    if (type === 'mafia') {
      // Navy Ink + Purple
      return {
        bgColor: '#070A12',
        surfaceColor: '#0D1220',
        borderColor: '#1C2541',
        textPrimary: '#E6EAF2',
        textSecondary: '#98A2B3',
        accentColor: '#A78BFA',
        accentHover: '#60A5FA',
      };
    } else if (type === 'liar') {
      // Warm Gray + Olive
      return {
        bgColor: '#0E0D0B',
        surfaceColor: '#171614',
        borderColor: '#2A2824',
        textPrimary: '#F1F0ED',
        textSecondary: '#A8A29E',
        accentColor: '#A3B18A',
        accentHover: '#7F8F69',
      };
    } else {
      // Charcoal Mono (soup or default)
      return {
        bgColor: '#0B0F14',
        surfaceColor: '#111827',
        borderColor: '#243041',
        textPrimary: '#E5E7EB',
        textSecondary: '#94A3B8',
        accentColor: '#38BDF8',
        accentHover: '#60A5FA',
      };
    }
  };

  const themeColors = getThemeColors(quizType);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!quizType) {
      newErrors.quizType = lang === 'ko' ? '게임 유형을 선택해주세요' : 'Please select a game type';
      setErrors(newErrors);
      return false;
    }
    
    if (quizType === 'liar') {
      // 라이어 게임 검증
      if (!roomName.trim()) {
        newErrors.roomName = lang === 'ko' ? '방 이름을 입력해주세요' : 'Please enter room name';
      } else if (roomName.trim().length < 2) {
        newErrors.roomName = lang === 'ko' ? '방 이름은 2자 이상이어야 합니다' : 'Room name must be at least 2 characters';
      } else if (roomName.trim().length > 20) {
        newErrors.roomName = lang === 'ko' ? '방 이름은 20자 이하여야 합니다' : 'Room name must be 20 characters or less';
      } else if (!/^[가-힣a-zA-Z0-9\s]+$/.test(roomName.trim())) {
        newErrors.roomName = lang === 'ko' ? '특수문자는 사용할 수 없습니다' : 'Special characters are not allowed';
      }
      
      if (!theme) {
        newErrors.theme = lang === 'ko' ? '주제를 선택해주세요' : 'Please select a theme';
      }
      
      if (maxPlayers < 3 || maxPlayers > 12) {
        newErrors.maxPlayers = lang === 'ko' ? '최대 인원은 3명 이상 12명 이하여야 합니다' : 'Max players must be between 3 and 12';
      }
      
      // 라이어 수는 자동 계산되므로 검증 불필요
    } else if (quizType === 'chat') {
      // 수다방 검증
      if (!chatRoomName.trim()) {
        newErrors.chatRoomName = lang === 'ko' ? '방 이름을 입력해주세요' : 'Please enter room name';
      } else if (chatRoomName.trim().length < 2) {
        newErrors.chatRoomName = lang === 'ko' ? '방 이름은 2자 이상이어야 합니다' : 'Room name must be at least 2 characters';
      } else if (chatRoomName.trim().length > 30) {
        newErrors.chatRoomName = lang === 'ko' ? '방 이름은 30자 이하여야 합니다' : 'Room name must be 30 characters or less';
      }
      
      if (usePassword && !password.trim()) {
        newErrors.password = lang === 'ko' ? '비밀번호를 입력해주세요' : 'Please enter a password';
      } else if (usePassword && password.trim().length < 4) {
        newErrors.password = lang === 'ko' ? '비밀번호는 4자 이상이어야 합니다' : 'Password must be at least 4 characters';
      }
    } else {
      // 바다거북스프/마피아 검증
      if (!story.trim()) {
        newErrors.story = lang === 'ko' ? '이야기를 입력해주세요' : 'Please enter a story';
      } else if (story.trim().length < 10) {
        newErrors.story = lang === 'ko' ? '이야기는 10자 이상이어야 합니다' : 'Story must be at least 10 characters';
      }
      
      if (!truth.trim()) {
        newErrors.truth = lang === 'ko' ? '진실을 입력해주세요' : 'Please enter the truth';
      } else if (truth.trim().length < 3) {
        newErrors.truth = lang === 'ko' ? '진실은 3자 이상이어야 합니다' : 'Truth must be at least 3 characters';
      }
      
      if (maxQuestions < 1 || maxQuestions > 100) {
        newErrors.maxQuestions = lang === 'ko' ? '최대 질문 수는 1개 이상 100개 이하여야 합니다' : 'Max questions must be between 1 and 100';
      }
      
      if (usePassword && !password.trim()) {
        newErrors.password = lang === 'ko' ? '비밀번호를 입력해주세요' : 'Please enter a password';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateRoomCode = (): string => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const generateInviteCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreate = async () => {
    if (!validateForm() || !quizType) {
      return;
    }

    if (!isSupabaseConfigured()) {
      alert(lang === 'ko' 
        ? 'Supabase가 설정되지 않았습니다.'
        : 'Supabase is not configured.');
      return;
    }

    if (!user) {
      alert(lang === 'ko' ? '로그인이 필요합니다.' : 'Login required.');
      return;
    }

    setIsCreating(true);

    try {
      const supabaseClient = createClient();
      
      // 호스트 닉네임: 로그인 유저 닉네임 자동 사용
      const { data: userData } = await supabaseClient
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();
      const finalHostNickname = userData?.nickname || user.id.substring(0, 8) || (lang === 'ko' ? '사용자' : 'User');
      
      // 고유한 방 코드 생성
      let roomCode = generateRoomCode();
      let codeExists = true;
      let attempts = 0;

      while (codeExists && attempts < 10) {
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('code')
          .eq('code', roomCode)
          .single();

        if (!existingRoom) {
          codeExists = false;
        } else {
          roomCode = generateRoomCode();
          attempts++;
        }
      }

      if (codeExists) {
        throw new Error(lang === 'ko' ? '방 코드 생성에 실패했습니다' : 'Failed to generate room code');
      }

      const currentLang = (lang === 'ko' || lang === 'en') ? lang : 'ko';
      
      // 수다방은 별도 처리
      if (quizType === 'chat') {
        const { data: userData } = await supabaseClient
          .from('users')
          .select('nickname')
          .eq('id', user.id)
          .maybeSingle();
        const finalHostNickname = userData?.nickname || user.email?.split('@')[0] || 'User';

        // 방 코드 생성 (중복 체크)
        const generateChatRoomCode = (): string => {
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
        };

        let chatCode = generateChatRoomCode();
        let retries = 10;
        while (retries > 0) {
          const { data: existing } = await supabaseClient
            .from('chat_rooms')
            .select('code')
            .eq('code', chatCode)
            .maybeSingle();
          
          if (!existing) break;
          chatCode = generateChatRoomCode();
          retries--;
        }

        // 수다방 생성
        const { data: chatRoom, error: chatRoomError } = await supabaseClient
          .from('chat_rooms')
          .insert({
            code: chatCode,
            name: chatRoomName.trim(),
            host_user_id: user.id,
            host_nickname: finalHostNickname,
            max_members: chatMaxMembers,
            is_public: !usePassword,
            password: usePassword ? password.trim() : null,
          })
          .select()
          .single();

        if (chatRoomError) throw chatRoomError;

        // 호스트를 멤버로 추가
        const { error: memberError } = await supabaseClient
          .from('chat_room_members')
          .insert({
            room_id: chatRoom.id,
            user_id: user.id,
            nickname: finalHostNickname,
          });

        if (memberError) throw memberError;

        // 채팅방으로 이동
        router.push(`/${lang}/chat/${chatCode}`);
        return;
      }
      
      let insertData: any = {};

      if (quizType === 'liar') {
        // 라이어 게임
        const inviteCode = isPrivate ? generateInviteCode() : null;
        
        insertData = {
          code: roomCode,
          room_name: roomName.trim(),
          theme: theme,
          level: level,
          max_players: maxPlayers,
          max_liars: 1, // 게임 시작 시 실제 인원으로 자동 계산됨
          is_private: isPrivate,
          invite_code: inviteCode,
          host_user_id: user.id,
          host_nickname: finalHostNickname,
          quiz_type: 'liar',
          status: 'LOBBY',
          game_ended: false,
          story: '',
          truth: '',
          max_questions: 999999,
          password: null,
          lang: currentLang,
          speaking_time_minutes: speakingTimeMinutes, // 발언 시간 (분)
        };
      } else {
        // 바다거북스프/마피아
        insertData = {
          code: roomCode,
          host_nickname: finalHostNickname,
          story: story.trim(),
          truth: truth.trim(),
          max_questions: maxQuestions,
          password: usePassword ? password.trim() : null,
          game_ended: false,
          status: 'active',
          quiz_type: quizType,
          lang: currentLang,
        };
      }

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert(insertData)
        .select('*')
        .single();

      if (roomError) {
        console.error('방 생성 오류:', roomError);
        // 컬럼이 없어서 에러가 발생한 경우 처리
        if (roomError.code === '42703' || roomError.message?.includes('column')) {
          console.warn('일부 컬럼이 없습니다. 기본 컬럼만 사용합니다.');
          // 기본 컬럼만 사용하여 재시도
          const basicData: any = {
            code: roomCode,
            host_nickname: finalHostNickname,
            story: quizType === 'liar' ? '' : story.trim(),
            truth: quizType === 'liar' ? '' : truth.trim(),
            max_questions: quizType === 'liar' ? 999999 : maxQuestions,
            game_ended: false,
            status: quizType === 'liar' ? 'LOBBY' : 'active',
            quiz_type: quizType,
          };
          
          // 라이어 게임인 경우 추가 필드 포함
          if (quizType === 'liar') {
            basicData.room_name = roomName.trim();
            basicData.theme = theme;
            basicData.level = level;
            basicData.max_players = maxPlayers;
            basicData.max_liars = 1;
            basicData.is_private = isPrivate;
            basicData.invite_code = isPrivate ? generateInviteCode() : null;
            basicData.host_user_id = user.id;
            basicData.speaking_time_minutes = speakingTimeMinutes;
          }
          
          const retryResult = await supabase
            .from('rooms')
            .insert(basicData)
            .select('*')
            .single();
          
          if (retryResult.error) throw retryResult.error;
          
          // 호스트를 players 테이블에 추가
          const { error: playerError } = await supabase
            .from('players')
            .insert({
              room_code: roomCode,
              nickname: finalHostNickname,
              is_host: true,
            });

          if (playerError) throw playerError;

          // 게임 타입별 리다이렉트
          const redirectPath = quizType === 'liar' 
            ? `/${lang}/liar_room/${roomCode}?host=true`
            : quizType === 'mafia'
            ? `/${lang}/mafia_room/${roomCode}?host=true`
            : `/${lang}/turtle_room/${roomCode}?host=true`;
          router.push(redirectPath);
          return;
        }
        throw roomError;
      }

      // insert 성공 확인 및 값 검증
      if (room && quizType === 'liar') {
        console.log('방 생성 성공:', {
          code: room.code,
          room_name: (room as any).room_name,
          theme: (room as any).theme,
          level: (room as any).level,
          max_players: (room as any).max_players,
        });
        
        // 값이 제대로 저장되지 않은 경우 업데이트
        if (!(room as any).room_name || !(room as any).theme || !(room as any).level) {
          console.warn('방 정보가 제대로 저장되지 않았습니다. 업데이트합니다.');
          const { error: updateError } = await supabase
            .from('rooms')
            .update({
              room_name: roomName.trim(),
              theme: theme,
              level: level,
              max_players: maxPlayers,
            })
            .eq('code', roomCode);
          
          if (updateError) {
            console.error('방 정보 업데이트 오류:', updateError);
          } else {
            console.log('방 정보 업데이트 성공');
          }
        }
      }

      // 호스트를 players 테이블에 추가
      const { error: playerError } = await supabase
        .from('players')
        .insert({
          room_code: roomCode,
          nickname: finalHostNickname,
          is_host: true,
        });

      if (playerError) throw playerError;

      // 게임 타입별 리다이렉트
      const redirectPath = quizType === 'liar' 
        ? `/${lang}/liar_room/${roomCode}?host=true`
        : quizType === 'mafia'
        ? `/${lang}/mafia_room/${roomCode}?host=true`
        : `/${lang}/turtle_room/${roomCode}?host=true`;
      router.push(redirectPath);
    } catch (error) {
      console.error('방 생성 오류:', error);
      alert(lang === 'ko' ? '방 생성에 실패했습니다.' : 'Failed to create room.');
      setIsCreating(false);
    }
  };

  const getTitle = () => {
    if (!quizType) {
      return lang === 'ko' ? '방 만들기' : 'Create Room';
    }
    if (quizType === 'liar') {
      return lang === 'ko' ? '라이어 게임 방 만들기' : 'Create Liar Game Room';
    }
    if (quizType === 'mafia') {
      return lang === 'ko' ? '마피아 게임 방 만들기' : 'Create Mafia Game Room';
    }
    if (quizType === 'chat') {
      return lang === 'ko' ? '수다방 만들기' : 'Create Chat Room';
    }
    return lang === 'ko' ? '바다거북스프 방 만들기' : 'Create Turtle Soup Room';
  };

  const getDescription = () => {
    if (!quizType) {
      return lang === 'ko' ? '게임 유형을 선택해주세요' : 'Please select a game type';
    }
    if (quizType === 'liar') {
      return lang === 'ko' 
        ? '방 이름과 주제, 난이도를 정하면 바로 시작할 수 있어요.'
        : 'Set room name, theme, and difficulty to start playing.';
    }
    return lang === 'ko' 
      ? '이야기와 진실을 설정하고 게임을 시작하세요.'
      : 'Set the story and truth to start the game.';
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: themeColors.bgColor, color: themeColors.textPrimary }}>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-2xl">
        {/* 뒤로가기 */}
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}`}>
            <button 
              className="transition-colors whitespace-nowrap text-sm sm:text-base"
              style={{ color: themeColors.textSecondary }}
              onMouseEnter={(e) => e.currentTarget.style.color = themeColors.textPrimary}
              onMouseLeave={(e) => e.currentTarget.style.color = themeColors.textSecondary}
            >
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        {/* 제목 */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: themeColors.accentColor }}>
            {getTitle()}
          </h1>
          <p className="text-xs sm:text-sm" style={{ color: themeColors.textSecondary }}>
            {getDescription()}
          </p>
        </div>

        <div className="space-y-5">
          {/* 게임 타입 선택 */}
          <div>
            <QuizTypeSelectorMultiplayer
              selectedType={quizType}
              onSelect={setQuizType}
              lang={lang === 'ko' || lang === 'en' ? lang : 'ko'}
              disabled={isCreating}
            />
            {errors.quizType && (
              <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                {errors.quizType}
              </p>
            )}
          </div>

          {quizType === 'liar' && (
            <>
              {/* 라이어 게임 안내 */}
              <div 
                className="mb-6 p-4 rounded-xl border"
                style={{ backgroundColor: themeColors.surfaceColor, borderColor: themeColors.borderColor }}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <i className="ri-information-line" style={{ color: themeColors.accentColor }}></i>
                    <h3 className="text-sm font-semibold" style={{ color: themeColors.textPrimary }}>
                      {lang === 'ko' ? '라이어 게임 규칙' : 'Liar Game Rules'}
                    </h3>
                  </div>
                  <ul className="text-xs space-y-1" style={{ color: themeColors.textSecondary }}>
                    <li>• {lang === 'ko' ? `최소 인원: 3명` : `Min players: 3`}</li>
                    <li>• {lang === 'ko' ? `최대 인원: ${maxPlayers}명` : `Max players: ${maxPlayers}`}</li>
                    <li>• {lang === 'ko' ? `라이어 수: 인원에 따라 자동 설정 (3~5명: 1명, 6~9명: 2명, 10명 이상: 3명)` : `Liar count: Auto-set by player count (3-5: 1, 6-9: 2, 10+: 3)`}</li>
                  </ul>
                </div>
              </div>

              {/* 방 이름 (필수) */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.textPrimary }}>
                  <i className="ri-door-open-line mr-1"></i>
                  {lang === 'ko' ? '방 이름' : 'Room Name'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => {
                    setRoomName(e.target.value);
                    if (errors.roomName) {
                      setErrors({ ...errors, roomName: '' });
                    }
                  }}
                  placeholder={lang === 'ko' ? '방 이름을 입력하세요 (2-20자)' : 'Enter room name (2-20 chars)'}
                  className="w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: errors.roomName ? '#F87171' : themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.accentColor;
                    e.target.style.boxShadow = `0 0 0 2px ${themeColors.accentColor}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = themeColors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                  maxLength={20}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors.roomName && (
                    <p className="text-xs" style={{ color: '#F87171' }}>
                      {errors.roomName}
                    </p>
                  )}
                  <p className="text-xs ml-auto" style={{ color: themeColors.textSecondary }}>
                    {roomName.length} / 20
                  </p>
                </div>
              </div>

              {/* 주제 선택 (필수) */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.textPrimary }}>
                  <i className="ri-bookmark-line mr-1"></i>
                  {lang === 'ko' ? '주제' : 'Theme'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {THEMES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTheme(t);
                        if (errors.theme) {
                          setErrors({ ...errors, theme: '' });
                        }
                      }}
                      className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all border"
                      style={{
                        backgroundColor: theme === t ? `${themeColors.accentColor}20` : themeColors.surfaceColor,
                        color: theme === t ? themeColors.accentColor : themeColors.textPrimary,
                        borderColor: theme === t ? themeColors.accentColor : themeColors.borderColor,
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {errors.theme && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.theme}
                  </p>
                )}
              </div>

              {/* 난이도 선택 (필수) */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: themeColors.textPrimary }}>
                  <i className="ri-bar-chart-line mr-1"></i>
                  {lang === 'ko' ? '난이도' : 'Difficulty'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setLevel(l.value)}
                      className="px-3 py-2.5 rounded-lg text-center transition-all border"
                      style={{
                        backgroundColor: level === l.value ? `${themeColors.accentColor}20` : themeColors.surfaceColor,
                        borderColor: level === l.value ? themeColors.accentColor : themeColors.borderColor,
                      }}
                    >
                      <div className="font-semibold text-sm" style={{ color: level === l.value ? themeColors.accentColor : themeColors.textPrimary }}>
                        {l.label}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: themeColors.textSecondary }}>
                        {l.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 최대 인원 (선택) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-group-line mr-1"></i>
                  {lang === 'ko' ? '최대 인원' : 'Max Players'}
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <input
                      type="range"
                      min="3"
                      max="12"
                      step="1"
                      value={maxPlayers}
                      onChange={(e) => {
                        setMaxPlayers(Number(e.target.value));
                        if (errors.maxPlayers) {
                          setErrors({ ...errors, maxPlayers: '' });
                        }
                      }}
                      className="flex-1"
                      style={{ accentColor: themeColors.accentColor }}
                    />
                    <span className="text-xl sm:text-2xl font-bold w-12 sm:w-16 text-center" style={{ color: themeColors.accentColor }}>
                      {maxPlayers}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' ? '3명부터 12명까지 함께 플레이할 수 있어요.' : 'You can play with 3 to 12 players.'}
                  </p>
                </div>
                {errors.maxPlayers && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.maxPlayers}
                  </p>
                )}
              </div>

              {/* 발언 시간 (선택) */}
              <div className="mb-4">
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-time-line mr-1"></i>
                  {lang === 'ko' ? '발언 시간' : 'Speaking Time'}
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="1"
                      value={speakingTimeMinutes}
                      onChange={(e) => {
                        setSpeakingTimeMinutes(Number(e.target.value));
                      }}
                      className="flex-1"
                      style={{ accentColor: themeColors.accentColor }}
                    />
                    <span className="text-xl sm:text-2xl font-bold w-12 sm:w-16 text-center" style={{ color: themeColors.accentColor }}>
                      {speakingTimeMinutes} {lang === 'ko' ? '분' : 'min'}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' ? '1분부터 3분까지 선택할 수 있어요.' : 'You can select from 1 to 3 minutes.'}
                  </p>
                </div>
              </div>

              {/* 비공개 여부 (선택) */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ 
                      accentColor: themeColors.accentColor,
                      backgroundColor: themeColors.surfaceColor,
                      borderColor: themeColors.borderColor,
                    }}
                  />
                  <span className="text-xs sm:text-sm" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' ? '비공개 방' : 'Private Room'}
                  </span>
                </label>
                {isPrivate && (
                  <p className="text-xs mt-2" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' 
                      ? '비공개로 설정하면 입장 코드가 필요합니다.'
                      : 'A private room requires an invite code to join.'}
                  </p>
                )}
              </div>
            </>
          )}

          {quizType === 'chat' && (
            <>
              {/* 수다방 생성 폼 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-chat-3-line mr-1"></i>
                  {lang === 'ko' ? '방 이름' : 'Room Name'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <input
                  type="text"
                  value={chatRoomName}
                  onChange={(e) => {
                    setChatRoomName(e.target.value);
                    if (errors.chatRoomName) {
                      setErrors({ ...errors, chatRoomName: '' });
                    }
                  }}
                  placeholder={lang === 'ko' ? '예: 친구들과 수다방' : 'e.g., Chat with Friends'}
                  className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: errors.chatRoomName ? '#F87171' : themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                  maxLength={30}
                />
                {errors.chatRoomName && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.chatRoomName}
                  </p>
                )}
              </div>

              {/* 최대 인원 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-group-line mr-1"></i>
                  {lang === 'ko' ? '최대 인원' : 'Max Members'}
                </label>
                <select
                  value={chatMaxMembers}
                  onChange={(e) => setChatMaxMembers(Number(e.target.value))}
                  className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                >
                  <option value={10}>10명</option>
                  <option value={20}>20명</option>
                  <option value={50}>50명</option>
                  <option value={100}>100명</option>
                </select>
              </div>

              {/* 비밀번호 (선택) */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => {
                      setUsePassword(e.target.checked);
                      if (!e.target.checked) {
                        setPassword('');
                        setErrors({ ...errors, password: '' });
                      }
                    }}
                    className="w-4 h-4 rounded"
                    style={{ 
                      accentColor: themeColors.accentColor,
                      backgroundColor: themeColors.surfaceColor,
                      borderColor: themeColors.borderColor,
                    }}
                  />
                  <span className="text-xs sm:text-sm" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' ? '비밀번호 설정' : 'Set Password'}
                  </span>
                </label>
                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors({ ...errors, password: '' });
                      }
                    }}
                    placeholder={lang === 'ko' ? '4자 이상' : 'At least 4 characters'}
                    className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all mt-2"
                    style={{
                      backgroundColor: themeColors.surfaceColor,
                      borderColor: errors.password ? '#F87171' : themeColors.borderColor,
                      color: themeColors.textPrimary,
                    }}
                    minLength={4}
                  />
                )}
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.password}
                  </p>
                )}
              </div>
            </>
          )}

          {(quizType === 'soup' || quizType === 'mafia') && (
            <>
              {/* 이야기 (필수) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-book-open-line mr-1"></i>
                  {lang === 'ko' ? '이야기' : 'Story'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <textarea
                  value={story}
                  onChange={(e) => {
                    setStory(e.target.value);
                    if (errors.story) {
                      setErrors({ ...errors, story: '' });
                    }
                  }}
                  placeholder={lang === 'ko' ? '게임의 배경이 되는 이야기를 입력하세요...' : 'Enter the story for the game...'}
                  rows={6}
                  className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all resize-none"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: errors.story ? '#F87171' : themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.accentColor;
                    e.target.style.boxShadow = `0 0 0 2px ${themeColors.accentColor}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = themeColors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {errors.story && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.story}
                  </p>
                )}
              </div>

              {/* 진실 (필수) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-lightbulb-line mr-1"></i>
                  {lang === 'ko' ? '진실' : 'Truth'} <span style={{ color: themeColors.accentColor }}>*</span>
                </label>
                <input
                  type="text"
                  value={truth}
                  onChange={(e) => {
                    setTruth(e.target.value);
                    if (errors.truth) {
                      setErrors({ ...errors, truth: '' });
                    }
                  }}
                  placeholder={lang === 'ko' ? '이야기의 진실을 입력하세요...' : 'Enter the truth of the story...'}
                  className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: errors.truth ? '#F87171' : themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.accentColor;
                    e.target.style.boxShadow = `0 0 0 2px ${themeColors.accentColor}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = themeColors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {errors.truth && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.truth}
                  </p>
                )}
              </div>

              {/* 최대 질문 수 (선택) */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: themeColors.textSecondary }}>
                  <i className="ri-question-line mr-1"></i>
                  {lang === 'ko' ? '최대 질문 수' : 'Max Questions'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxQuestions}
                  onChange={(e) => {
                    setMaxQuestions(Number(e.target.value));
                    if (errors.maxQuestions) {
                      setErrors({ ...errors, maxQuestions: '' });
                    }
                  }}
                  className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                  style={{
                    backgroundColor: themeColors.surfaceColor,
                    borderColor: errors.maxQuestions ? '#F87171' : themeColors.borderColor,
                    color: themeColors.textPrimary,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = themeColors.accentColor;
                    e.target.style.boxShadow = `0 0 0 2px ${themeColors.accentColor}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = themeColors.borderColor;
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {errors.maxQuestions && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.maxQuestions}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                  {lang === 'ko' ? '1개부터 100개까지 설정할 수 있어요.' : 'You can set between 1 and 100 questions.'}
                </p>
              </div>

              {/* 비밀번호 (선택) */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => {
                      setUsePassword(e.target.checked);
                      if (!e.target.checked) {
                        setPassword('');
                        setErrors({ ...errors, password: '' });
                      }
                    }}
                    className="w-4 h-4 rounded"
                    style={{ 
                      accentColor: themeColors.accentColor,
                      backgroundColor: themeColors.surfaceColor,
                      borderColor: themeColors.borderColor,
                    }}
                  />
                  <span className="text-xs sm:text-sm" style={{ color: themeColors.textSecondary }}>
                    {lang === 'ko' ? '비밀번호 설정' : 'Set Password'}
                  </span>
                </label>
                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) {
                        setErrors({ ...errors, password: '' });
                      }
                    }}
                    placeholder={lang === 'ko' ? '비밀번호를 입력하세요...' : 'Enter password...'}
                    className="w-full rounded-xl px-4 py-3 text-sm border focus:outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: themeColors.surfaceColor,
                      borderColor: errors.password ? '#F87171' : themeColors.borderColor,
                      color: themeColors.textPrimary,
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = themeColors.accentColor;
                      e.target.style.boxShadow = `0 0 0 2px ${themeColors.accentColor}40`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = themeColors.borderColor;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                )}
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#F87171' }}>
                    {errors.password}
                  </p>
                )}
              </div>
            </>
          )}

          {/* 생성 버튼 */}
          {quizType && (
            <button
              onClick={handleCreate}
              disabled={
                isCreating || 
                !user || 
                (quizType === 'liar' && (!roomName.trim() || !theme)) ||
                ((quizType === 'soup' || quizType === 'mafia') && (!story.trim() || !truth.trim())) ||
                (quizType === 'chat' && !chatRoomName.trim())
              }
              className="w-full font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg mt-6 sm:mt-8 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              style={{
                background: (
                  isCreating || 
                  !user || 
                  (quizType === 'liar' && (!roomName.trim() || !theme)) ||
                  ((quizType === 'soup' || quizType === 'mafia') && (!story.trim() || !truth.trim())) ||
                  (quizType === 'chat' && !chatRoomName.trim())
                )
                  ? `${themeColors.accentColor}50`
                  : `linear-gradient(to right, ${themeColors.accentColor}, ${themeColors.accentHover})`,
                color: themeColors.bgColor,
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${themeColors.accentHover}, ${themeColors.accentColor})`;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${themeColors.accentColor}50`;
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = `linear-gradient(to right, ${themeColors.accentColor}, ${themeColors.accentHover})`;
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <i className="ri-door-open-line mr-2"></i>
              {isCreating 
                ? (lang === 'ko' ? '방 생성 중...' : 'Creating room...')
                : (lang === 'ko' ? '방 만들기' : 'Create Room')
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
