'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function PlaySelectPage() {
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 max-w-4xl">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {lang === 'ko' ? '게임 선택' : 'Select Game'}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base lg:text-lg">
            {lang === 'ko' 
              ? '플레이할 게임을 선택하세요'
              : 'Choose a game to play'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* 바다거북 스프 */}
          <Link href={`/${lang}/problems`}>
            <div className="group relative bg-slate-800 rounded-2xl p-6 sm:p-8 border-2 border-slate-700 hover:border-teal-500 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/20 cursor-pointer h-full">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-4 text-teal-400 group-hover:scale-110 transition-transform">
                  <i className="ri-bowl-line"></i>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">
                  {lang === 'ko' ? '바다거북 스프' : 'Turtle Soup'}
                </h2>
                <p className="text-sm sm:text-base text-slate-400 mb-4">
                  {lang === 'ko' 
                    ? 'Yes/No 질문으로 진실을 추리하는 게임'
                    : 'Guess the truth with Yes/No questions'}
                </p>
                <div className="flex items-center justify-center gap-2 text-teal-400 text-sm">
                  <span>{lang === 'ko' ? '플레이하기' : 'Play'}</span>
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>
          </Link>

          {/* 맞추기 게임 */}
          <Link href={`/${lang}/guess`}>
            <div className="group relative bg-slate-800 rounded-2xl p-6 sm:p-8 border-2 border-slate-700 hover:border-purple-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 cursor-pointer h-full">
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-4 text-purple-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 sm:w-12 sm:h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">
                  {lang === 'ko' ? '맞추기 게임' : 'Guess Game'}
                </h2>
                <p className="text-sm sm:text-base text-slate-400 mb-4">
                  {lang === 'ko' 
                    ? '이미지를 보고 정답을 맞히는 게임'
                    : 'Guess answers from images'}
                </p>
                <div className="flex items-center justify-center gap-2 text-purple-400 text-sm">
                  <span>{lang === 'ko' ? '플레이하기' : 'Play'}</span>
                  <i className="ri-arrow-right-line"></i>
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href={`/${lang}`}>
            <button className="text-slate-400 hover:text-white transition-colors text-sm sm:text-base">
              <i className="ri-arrow-left-line mr-2"></i>
              {lang === 'ko' ? '메인으로 돌아가기' : 'Back to Main'}
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
