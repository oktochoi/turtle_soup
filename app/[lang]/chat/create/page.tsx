'use client';

import { use } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function CreateChatRoom({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  const [roomName, setRoomName] = useState('');
  const [maxMembers, setMaxMembers] = useState(50);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/auth/login`);
    }
  }, [authLoading, user, lang, router]);

  const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동하기 쉬운 문자 제외
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async () => {
    if (!user) return;
    
    setError('');
    
    if (!roomName.trim()) {
      setError(lang === 'ko' ? '방 이름을 입력해주세요.' : 'Please enter a room name.');
      return;
    }

    if (roomName.trim().length < 2 || roomName.trim().length > 30) {
      setError(lang === 'ko' ? '방 이름은 2자 이상 30자 이하여야 합니다.' : 'Room name must be between 2 and 30 characters.');
      return;
    }

    if (usePassword && (!password.trim() || password.length < 4)) {
      setError(lang === 'ko' ? '비밀번호는 4자 이상이어야 합니다.' : 'Password must be at least 4 characters.');
      return;
    }

    setIsCreating(true);

    try {
      const supabase = createClient();
      
      // 사용자 닉네임 가져오기
      const { data: userData } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', user.id)
        .maybeSingle();

      const hostNickname = userData?.nickname || user.email?.split('@')[0] || 'User';

      // 방 코드 생성 (중복 체크)
      let code = generateRoomCode();
      let retries = 10;
      while (retries > 0) {
        const { data: existing } = await supabase
          .from('chat_rooms')
          .select('code')
          .eq('code', code)
          .maybeSingle();
        
        if (!existing) break;
        code = generateRoomCode();
        retries--;
      }

      // 방 생성
      const { data: room, error: insertError } = await supabase
        .from('chat_rooms')
        .insert({
          code,
          name: roomName.trim(),
          host_user_id: user.id,
          host_nickname: hostNickname,
          max_members: maxMembers,
          is_public: !usePassword,
          password: usePassword ? password : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 호스트를 멤버로 추가
      const { error: memberError } = await supabase
        .from('chat_room_members')
        .insert({
          room_id: room.id,
          user_id: user.id,
          nickname: hostNickname,
        });

      if (memberError) throw memberError;

      // 채팅방으로 이동
      router.push(`/${lang}/chat/${code}`);
    } catch (err: any) {
      console.error('잡담방 생성 오류:', err);
      setError(lang === 'ko' 
        ? `잡담방 생성에 실패했습니다.\n\n${err?.message || ''}`
        : `Failed to create chat room.\n\n${err?.message || ''}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
          {lang === 'ko' ? '잡담방 만들기' : 'Create Chat Room'}
        </h1>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '방 이름' : 'Room Name'} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder={lang === 'ko' ? '예: 친구들과 수다방' : 'e.g., Chat with Friends'}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm"
              maxLength={30}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '최대 인원' : 'Max Members'}
            </label>
            <select
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm"
            >
              <option value={10}>10명</option>
              <option value={20}>20명</option>
              <option value={50}>50명</option>
              <option value={100}>100명</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="w-4 h-4 text-teal-600 bg-slate-900 border-slate-700 rounded"
              />
              <span className="text-sm text-slate-300">
                {lang === 'ko' ? '비밀번호 설정' : 'Set Password'}
              </span>
            </label>
          </div>

          {usePassword && (
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '비밀번호' : 'Password'} <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={lang === 'ko' ? '4자 이상' : 'At least 4 characters'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm"
                minLength={4}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-300 whitespace-pre-line">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-xl transition-all"
          >
            {isCreating ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                {lang === 'ko' ? '생성 중...' : 'Creating...'}
              </>
            ) : (
              <>
                <i className="ri-chat-3-line mr-2"></i>
                {lang === 'ko' ? '잡담방 만들기' : 'Create Chat Room'}
              </>
            )}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            {lang === 'ko' ? '돌아가기' : 'Go Back'}
          </button>
        </div>
      </div>
    </div>
  );
}

