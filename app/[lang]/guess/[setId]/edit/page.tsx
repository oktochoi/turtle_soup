'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useTranslations } from '@/hooks/useTranslations';
import { GuessCard } from '@/lib/types/guess';

type CardType = 'text' | 'ox' | 'media';

export default function EditGuessSetPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const setId = params?.setId as string;
  const router = useRouter();
  const t = useTranslations();
  const { user, isLoading: authLoading } = useAuth();
  
  const [setTitle, setSetTitle] = useState('');
  const [cards, setCards] = useState<GuessCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  
  // 편집 중인 카드 상태
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardQuestion, setEditCardQuestion] = useState('');
  const [editCardAnswers, setEditCardAnswers] = useState<string[]>([]);
  
  // 새 카드 추가 상태
  const [newCardType, setNewCardType] = useState<CardType>('text');
  const [newCardQuestion, setNewCardQuestion] = useState(''); // 텍스트 질문 (필수)
  const [newCardImages, setNewCardImages] = useState<string[]>([]);
  const [newCardImageFiles, setNewCardImageFiles] = useState<File[]>([]);
  const [newCardMediaUrl, setNewCardMediaUrl] = useState('');
  const [newCardMediaStartTime, setNewCardMediaStartTime] = useState<number>(0); // YouTube 시작 시간 (초)
  const [newCardAnswers, setNewCardAnswers] = useState<string[]>(['']);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${lang}/auth/login`);
      return;
    }
    if (!authLoading && user && setId) {
      loadSet();
    }
  }, [authLoading, user, setId, lang, router]);

  const loadSet = async () => {
    if (!setId) return;
    
    try {
      const supabase = createClient();
      
      // 세트 정보 로드
      const { data: guessSet, error: setError } = await supabase
        .from('guess_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      if (!guessSet) throw new Error('세트를 찾을 수 없습니다.');

      // 권한 확인
      if (guessSet.creator_id !== user?.id) {
        alert(lang === 'ko' ? '수정 권한이 없습니다.' : 'No permission to edit.');
        router.push(`/${lang}/guess/${setId}`);
        return;
      }

      setSetTitle(guessSet.title);

      // 카드 로드
      const { data: guessCards, error: cardsError } = await supabase
        .from('guess_cards')
        .select('*')
        .eq('set_id', setId)
        .order('order_index', { ascending: true });

      if (cardsError) throw cardsError;
      setCards(guessCards || []);
    } catch (error: any) {
      console.error('세트 로드 오류:', error);
      alert(lang === 'ko' ? `세트를 불러오는데 실패했습니다.\n\n${error?.message || ''}` : `Failed to load set.\n\n${error?.message || ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!setId || !user) return;

    // 유효성 검사
    // 텍스트 질문은 필수
    if (!newCardQuestion.trim()) {
      alert(lang === 'ko' ? '질문을 입력해주세요.' : 'Please enter a question.');
      return;
    }

    if (newCardType === 'media' && !newCardMediaUrl.trim()) {
      alert(lang === 'ko' ? 'YouTube 링크를 입력해주세요.' : 'Please enter a YouTube URL.');
      return;
    }

    if (newCardType === 'ox' && newCardAnswers[0] !== 'O' && newCardAnswers[0] !== 'X') {
      alert(lang === 'ko' ? 'O 또는 X를 선택해주세요.' : 'Please select O or X.');
      return;
    }

    if (newCardType !== 'ox' && newCardAnswers.filter(a => a.trim()).length === 0) {
      alert(lang === 'ko' ? '정답을 최소 1개 이상 입력해주세요.' : 'Please enter at least one answer.');
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      
      let images: string[] = [];
      let mediaUrl: string | null = null;

      // 이미지 업로드 (text, ox 타입)
      if ((newCardType === 'text' || newCardType === 'ox') && newCardImageFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (const file of newCardImageFiles) {
          const fileName = `card_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;
          const filePath = `guess-cards/${setId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('quiz-images')
            .upload(filePath, file);

          if (uploadError) {
            console.error('이미지 업로드 오류:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('quiz-images')
            .getPublicUrl(filePath);
          uploadedUrls.push(publicUrl);
        }
        images = [...newCardImages, ...uploadedUrls];
      } else if (newCardType === 'text' || newCardType === 'ox') {
        images = newCardImages;
      }

      // YouTube 링크 처리 (media 타입)
      if (newCardType === 'media' && newCardMediaUrl.trim()) {
        let youtubeUrl = newCardMediaUrl.trim();
        
        // YouTube URL 정규화
        // https://www.youtube.com/watch?v=xxx -> https://youtu.be/xxx
        // 또는 https://youtu.be/xxx -> https://youtu.be/xxx
        const watchMatch = youtubeUrl.match(/youtube\.com\/watch\?v=([^&]+)/);
        const shortMatch = youtubeUrl.match(/youtu\.be\/([^?]+)/);
        
        if (watchMatch) {
          const videoId = watchMatch[1];
          youtubeUrl = `https://youtu.be/${videoId}`;
        } else if (shortMatch) {
          const videoId = shortMatch[1];
          youtubeUrl = `https://youtu.be/${videoId}`;
        }
        
        // 시작 시간 추가
        if (newCardMediaStartTime > 0) {
          const separator = youtubeUrl.includes('?') ? '&' : '?';
          youtubeUrl = `${youtubeUrl}${separator}t=${newCardMediaStartTime}s`;
        }
        
        mediaUrl = youtubeUrl;
      }

      // 카드 생성
      const { error: insertError } = await supabase
        .from('guess_cards')
        .insert({
          set_id: setId,
          card_type: newCardType,
          question: newCardQuestion.trim(),
          images: images.length > 0 ? images : [],
          media_url: mediaUrl,
          answers: newCardAnswers.filter(a => a.trim()),
          order_index: cards.length,
        });

      if (insertError) throw insertError;

      // 폼 초기화
      setNewCardType('text');
      setNewCardQuestion('');
      setNewCardImages([]);
      setNewCardImageFiles([]);
      setNewCardMediaUrl('');
      setNewCardMediaStartTime(0);
      setNewCardAnswers(['']);

      // 카드 목록 새로고침
      await loadSet();
    } catch (error: any) {
      console.error('카드 추가 오류:', error);
      alert(lang === 'ko' ? `카드 추가에 실패했습니다.\n\n${error?.message || ''}` : `Failed to add card.\n\n${error?.message || ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm(lang === 'ko' ? '이 카드를 삭제하시겠습니까?' : 'Are you sure you want to delete this card?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('guess_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      await loadSet();
    } catch (error: any) {
      console.error('카드 삭제 오류:', error);
      alert(lang === 'ko' ? `카드 삭제에 실패했습니다.\n\n${error?.message || ''}` : `Failed to delete card.\n\n${error?.message || ''}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
          <p className="text-slate-400">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-4xl">
        <div className="mb-4 sm:mb-6">
          <Link href={`/${lang}/guess/${setId}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-xs sm:text-sm">
              <i className="ri-arrow-left-line mr-2"></i>
              {t.common.back}
            </button>
          </Link>
        </div>

        <div className="text-center mb-4 sm:mb-6 lg:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {setTitle || (lang === 'ko' ? '카드 편집' : 'Edit Cards')}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            {lang === 'ko' ? '카드를 추가하고 편집하세요' : 'Add and edit cards'}
          </p>
        </div>

        {/* 카드 추가 폼 */}
        <div className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700 mb-6">
          <h2 className="text-lg font-semibold mb-4">{lang === 'ko' ? '새 카드 추가' : 'Add New Card'}</h2>
          
          {/* 카드 타입 선택 */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '카드 타입' : 'Card Type'} <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setNewCardType('text')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  newCardType === 'text'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <i className="ri-text-block text-2xl mb-2 block"></i>
                <div className="text-xs font-semibold">{lang === 'ko' ? '주관식' : 'Text'}</div>
              </button>
              <button
                onClick={() => setNewCardType('ox')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  newCardType === 'ox'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <i className="ri-checkbox-circle-line text-2xl mb-2 block"></i>
                <div className="text-xs font-semibold">O/X</div>
              </button>
              <button
                onClick={() => setNewCardType('media')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  newCardType === 'media'
                    ? 'border-teal-500 bg-teal-500/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <i className="ri-video-line text-2xl mb-2 block"></i>
                <div className="text-xs font-semibold">{lang === 'ko' ? '영상/오디오' : 'Media'}</div>
              </button>
            </div>
          </div>

          {/* 질문 입력 (모든 타입 공통, 필수) */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '질문' : 'Question'} <span className="text-red-400">*</span>
            </label>
            <textarea
              value={newCardQuestion}
              onChange={(e) => setNewCardQuestion(e.target.value)}
              placeholder={lang === 'ko' ? '질문을 입력하세요 (예: 딸기가 실업을 하면?)' : 'Enter question (e.g., What happens when a strawberry is unemployed?)'}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-none"
              maxLength={500}
            />
          </div>

          {/* 주관식 (text) 타입 */}
          {newCardType === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '이미지 (선택사항)' : 'Images (Optional)'}
                </label>
                <div className="space-y-2">
                  {newCardImages.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <img src={url} alt={`Image ${idx + 1}`} className="w-20 h-20 object-cover rounded" />
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...newCardImages];
                          newUrls[idx] = e.target.value;
                          setNewCardImages(newUrls);
                        }}
                        placeholder={lang === 'ko' ? '이미지 URL' : 'Image URL'}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => {
                          const newUrls = newCardImages.filter((_, i) => i !== idx);
                          setNewCardImages(newUrls);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  ))}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      // 파일 크기 제한 (5MB)
                      const maxSize = 5 * 1024 * 1024; // 5MB
                      const validFiles: File[] = [];
                      const invalidFiles: string[] = [];
                      
                      for (const file of files) {
                        if (file.size > maxSize) {
                          invalidFiles.push(file.name);
                        } else {
                          validFiles.push(file);
                        }
                      }
                      
                      if (invalidFiles.length > 0) {
                        alert(lang === 'ko' 
                          ? `다음 이미지 파일이 너무 큽니다 (최대 5MB):\n${invalidFiles.join('\n')}`
                          : `These image files are too large (max 5MB):\n${invalidFiles.join('\n')}`);
                      }
                      
                      if (validFiles.length > 0) {
                        setNewCardImageFiles([...newCardImageFiles, ...validFiles]);
                      }
                      
                      // input 초기화
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="card-images-input"
                  />
                  <label
                    htmlFor="card-images-input"
                    className="block w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-center cursor-pointer hover:bg-slate-800 transition-colors text-sm"
                  >
                    <i className="ri-image-add-line mr-2"></i>
                    {lang === 'ko' ? '이미지 추가 (최대 5MB)' : 'Add Images (max 5MB)'}
                  </label>
                  <button
                    onClick={() => setNewCardImages([...newCardImages, ''])}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-center hover:bg-slate-800 transition-colors text-sm"
                  >
                    <i className="ri-link mr-2"></i>
                    {lang === 'ko' ? 'URL로 이미지 추가' : 'Add Image by URL'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* O/X 타입 */}
          {newCardType === 'ox' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '이미지 (선택사항)' : 'Images (Optional)'}
                </label>
                <div className="space-y-2">
                  {/* 기존 이미지 (URL 및 파일) */}
                  {newCardImages.map((url, idx) => (
                    url && (
                      <div key={idx} className="flex items-center gap-2">
                        <img src={url} alt={`Image ${idx + 1}`} className="w-20 h-20 object-cover rounded" />
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            const newUrls = [...newCardImages];
                            newUrls[idx] = e.target.value;
                            setNewCardImages(newUrls);
                          }}
                          placeholder={lang === 'ko' ? '이미지 URL' : 'Image URL'}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => {
                            const newUrls = newCardImages.filter((_, i) => i !== idx);
                            setNewCardImages(newUrls);
                          }}
                          className="text-red-400 hover:text-red-300"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                    )
                  ))}
                  {newCardImageFiles.map((file, idx) => (
                    <div key={`file-${idx}`} className="flex items-center gap-2">
                      <div className="w-20 h-20 bg-slate-700 rounded flex items-center justify-center">
                        <i className="ri-image-line text-2xl text-slate-400"></i>
                      </div>
                      <div className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300">
                        {file.name}
                      </div>
                      <button
                        onClick={() => {
                          const newFiles = newCardImageFiles.filter((_, i) => i !== idx);
                          setNewCardImageFiles(newFiles);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                    </div>
                  ))}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      // 파일 크기 제한 (5MB)
                      const maxSize = 5 * 1024 * 1024; // 5MB
                      const validFiles: File[] = [];
                      const invalidFiles: string[] = [];
                      
                      for (const file of files) {
                        if (file.size > maxSize) {
                          invalidFiles.push(file.name);
                        } else {
                          validFiles.push(file);
                        }
                      }
                      
                      if (invalidFiles.length > 0) {
                        alert(lang === 'ko' 
                          ? `다음 이미지 파일이 너무 큽니다 (최대 5MB):\n${invalidFiles.join('\n')}`
                          : `These image files are too large (max 5MB):\n${invalidFiles.join('\n')}`);
                      }
                      
                      if (validFiles.length > 0) {
                        setNewCardImageFiles([...newCardImageFiles, ...validFiles]);
                      }
                      
                      // input 초기화
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="ox-card-images-input"
                  />
                  <label
                    htmlFor="ox-card-images-input"
                    className="block w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-center cursor-pointer hover:bg-slate-800 transition-colors text-sm"
                  >
                    <i className="ri-image-add-line mr-2"></i>
                    {lang === 'ko' ? '이미지 추가 (최대 5MB)' : 'Add Images (max 5MB)'}
                  </label>
                  <button
                    onClick={() => setNewCardImages([...newCardImages, ''])}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-center hover:bg-slate-800 transition-colors text-sm"
                  >
                    <i className="ri-link mr-2"></i>
                    {lang === 'ko' ? 'URL로 이미지 추가' : 'Add Image by URL'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '정답' : 'Correct Answer'} <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewCardAnswers(['O'])}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      newCardAnswers[0] === 'O'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-3xl font-bold mb-1">O</div>
                    <div className="text-xs">{lang === 'ko' ? '맞음' : 'Correct'}</div>
                  </button>
                  <button
                    onClick={() => setNewCardAnswers(['X'])}
                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                      newCardAnswers[0] === 'X'
                        ? 'border-teal-500 bg-teal-500/10 text-teal-400'
                        : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-3xl font-bold mb-1">X</div>
                    <div className="text-xs">{lang === 'ko' ? '틀림' : 'Incorrect'}</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 영상/오디오 타입 (YouTube) */}
          {newCardType === 'media' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? 'YouTube 링크' : 'YouTube URL'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCardMediaUrl}
                  onChange={(e) => {
                    setNewCardMediaUrl(e.target.value);
                  }}
                  placeholder={lang === 'ko' ? 'https://www.youtube.com/watch?v=... 또는 https://youtu.be/...' : 'https://www.youtube.com/watch?v=... or https://youtu.be/...'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ko' ? 'YouTube 링크를 입력해주세요' : 'Enter a YouTube URL'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">
                  {lang === 'ko' ? '시작 시간 (초)' : 'Start Time (seconds)'} <span className="text-slate-500">(선택사항)</span>
                </label>
                <input
                  type="number"
                  value={newCardMediaStartTime}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setNewCardMediaStartTime(Math.max(0, val));
                  }}
                  min={0}
                  placeholder={lang === 'ko' ? '예: 15 (15초부터 시작)' : 'e.g., 15 (start at 15 seconds)'}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ko' ? '영상의 시작 시간을 초 단위로 입력하세요 (0은 처음부터)' : 'Enter the start time in seconds (0 for from the beginning)'}
                </p>
              </div>
            </div>
          )}

          {/* 정답 입력 (주관식, 영상 타입만) */}
          {newCardType !== 'ox' && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '정답' : 'Answers'} <span className="text-red-400">*</span>
              </label>
              {newCardAnswers.map((answer, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => {
                      const newAnswers = [...newCardAnswers];
                      newAnswers[idx] = e.target.value;
                      setNewCardAnswers(newAnswers);
                    }}
                    placeholder={lang === 'ko' ? '정답 입력 (동의어도 가능)' : 'Enter answer (synonyms allowed)'}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                  />
                  {newCardAnswers.length > 1 && (
                    <button
                      onClick={() => {
                        const newAnswers = newCardAnswers.filter((_, i) => i !== idx);
                        setNewCardAnswers(newAnswers);
                      }}
                      className="text-red-400 hover:text-red-300 px-2"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setNewCardAnswers([...newCardAnswers, ''])}
                className="text-teal-400 hover:text-teal-300 text-sm"
              >
                <i className="ri-add-line mr-1"></i>
                {lang === 'ko' ? '정답 추가' : 'Add Answer'}
              </button>
            </div>
          )}

          {/* 추가 버튼 */}
          <button
            onClick={handleAddCard}
            disabled={isSaving}
            className="w-full mt-6 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-xl transition-all text-sm"
          >
            {isSaving ? (
              <>
                <i className="ri-loader-4-line animate-spin mr-2"></i>
                {lang === 'ko' ? '추가 중...' : 'Adding...'}
              </>
            ) : (
              <>
                <i className="ri-add-line mr-2"></i>
                {lang === 'ko' ? '카드 추가' : 'Add Card'}
              </>
            )}
          </button>
        </div>

        {/* 완성하기 버튼 */}
        {cards.length >= 10 && (
          <div className="mb-6">
            <Link href={`/${lang}/guess/${setId}`}>
              <button className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-4 py-3 rounded-xl transition-all text-base">
                <i className="ri-check-line mr-2"></i>
                {lang === 'ko' ? '완성하기' : 'Complete'}
              </button>
            </Link>
            <p className="text-xs text-slate-400 text-center mt-2">
              {lang === 'ko' 
                ? `✅ 카드 ${cards.length}개가 준비되었습니다.` 
                : `✅ ${cards.length} cards ready.`}
            </p>
          </div>
        )}

        {/* 카드 개수 안내 */}
        {cards.length < 10 && (
          <div className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
            <p className="text-sm text-yellow-300 text-center">
              <i className="ri-error-warning-line mr-2"></i>
              {lang === 'ko' 
                ? `최소 10개의 카드가 필요합니다. (현재: ${cards.length}/10)` 
                : `Minimum 10 cards required. (Current: ${cards.length}/10)`}
            </p>
          </div>
        )}

        {/* 카드 목록 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{lang === 'ko' ? '카드 목록' : 'Card List'} ({cards.length}/10)</h2>
          {cards.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
              <p className="text-slate-400">{lang === 'ko' ? '아직 카드가 없습니다. 위에서 카드를 추가하세요.' : 'No cards yet. Add cards above.'}</p>
            </div>
          ) : (
            cards.map((card, idx) => (
              <div key={card.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-teal-400">#{idx + 1}</span>
                      <span className="text-xs px-2 py-1 bg-slate-700 rounded">
                        {card.card_type === 'text' ? (lang === 'ko' ? '주관식' : 'Text') :
                         card.card_type === 'ox' ? 'O/X' :
                         (lang === 'ko' ? '영상/오디오' : 'Media')}
                      </span>
                    </div>
                    {card.question && (
                      <div className="text-sm text-slate-200 mb-2 font-medium">
                        {lang === 'ko' ? '질문' : 'Question'}: {card.question}
                      </div>
                    )}
                    <div className="text-sm text-slate-300">
                      {lang === 'ko' ? '정답' : 'Answers'}: {Array.isArray(card.answers) ? card.answers.join(', ') : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingCardId === card.id ? (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              const supabase = createClient();
                              const { error } = await supabase
                                .from('guess_cards')
                                .update({
                                  question: editCardQuestion.trim(),
                                  answers: editCardAnswers.filter(a => a.trim()),
                                })
                                .eq('id', card.id);

                              if (error) throw error;
                              setEditingCardId(null);
                              setEditCardQuestion('');
                              setEditCardAnswers([]);
                              await loadSet();
                            } catch (error: any) {
                              console.error('카드 수정 오류:', error);
                              alert(lang === 'ko' ? `카드 수정 실패: ${error?.message}` : `Failed to update card: ${error?.message}`);
                            }
                          }}
                          className="text-green-400 hover:text-green-300"
                          title={lang === 'ko' ? '저장' : 'Save'}
                        >
                          <i className="ri-check-line"></i>
                        </button>
                        <button
                          onClick={() => {
                            setEditingCardId(null);
                            setEditCardQuestion('');
                            setEditCardAnswers([]);
                          }}
                          className="text-slate-400 hover:text-slate-300"
                          title={lang === 'ko' ? '취소' : 'Cancel'}
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingCardId(card.id);
                            setEditCardQuestion(card.question || '');
                            setEditCardAnswers(Array.isArray(card.answers) ? [...card.answers] : ['']);
                          }}
                          className="text-teal-400 hover:text-teal-300"
                          title={lang === 'ko' ? '편집' : 'Edit'}
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="text-red-400 hover:text-red-300"
                          title={lang === 'ko' ? '삭제' : 'Delete'}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {editingCardId === card.id ? (
                  <div className="mt-3 space-y-3 p-3 bg-slate-900 rounded-lg">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">
                        {lang === 'ko' ? '질문' : 'Question'} <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={editCardQuestion}
                        onChange={(e) => setEditCardQuestion(e.target.value)}
                        placeholder={lang === 'ko' ? '질문을 입력하세요' : 'Enter question'}
                        rows={3}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-none"
                        maxLength={500}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-300">
                        {lang === 'ko' ? '정답' : 'Answers'} <span className="text-red-400">*</span>
                      </label>
                      {editCardAnswers.map((answer, ansIdx) => (
                        <div key={ansIdx} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={answer}
                            onChange={(e) => {
                              const newAnswers = [...editCardAnswers];
                              newAnswers[ansIdx] = e.target.value;
                              setEditCardAnswers(newAnswers);
                            }}
                            placeholder={lang === 'ko' ? '정답 입력' : 'Enter answer'}
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                          />
                          {editCardAnswers.length > 1 && (
                            <button
                              onClick={() => {
                                const newAnswers = editCardAnswers.filter((_, i) => i !== ansIdx);
                                setEditCardAnswers(newAnswers);
                              }}
                              className="text-red-400 hover:text-red-300 px-2"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => setEditCardAnswers([...editCardAnswers, ''])}
                        className="text-teal-400 hover:text-teal-300 text-xs"
                      >
                        <i className="ri-add-line mr-1"></i>
                        {lang === 'ko' ? '정답 추가' : 'Add Answer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {card.card_type === 'text' && Array.isArray(card.images) && card.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mt-2">
                        {card.images.map((img, imgIdx) => (
                          <img key={imgIdx} src={img} alt={`Card ${idx + 1} Image ${imgIdx + 1}`} className="w-20 h-20 object-cover rounded" />
                        ))}
                      </div>
                    )}
                    {card.card_type === 'media' && card.media_url && (
                      <div className="mt-2">
                        <div className="text-xs text-slate-400">{lang === 'ko' ? '미디어' : 'Media'}: {card.media_url}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

