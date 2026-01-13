'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function TutorialPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-200 selection:bg-teal-500/30 overflow-x-hidden">
      {/* 배경 장식: 심해의 느낌을 주는 은은한 빛 점들 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-teal-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-900/20 blur-[120px]" />
      </div>

      <div className="container mx-auto px-6 py-12 max-w-4xl relative z-10">
        
        {/* 상단 헤더: 조금 더 미니멀하고 고급스럽게 */}
        <header className="text-center mb-20 space-y-4">
          <div className="relative inline-block">
             <span className="text-7xl block mb-2 animate-pulse filter drop-shadow-[0_0_15px_rgba(20,184,166,0.5)]">🐢</span>
             <div className="absolute -inset-1 bg-gradient-to-r from-teal-500 to-blue-500 rounded-full blur opacity-20"></div>
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white">
            {t.tutorial.title}
          </h1>
          <p className="text-slate-400 font-light tracking-[0.2em] uppercase text-sm">
            {t.tutorial.subtitle}
          </p>
        </header>

        {/* 메인 가이드 섹션: 카드 디자인 변경 */}
        <section className="grid gap-8">
          
          {/* 01. 컨셉 정의 */}
          <div className="group relative bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-3xl transition-all hover:border-teal-500/50 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs font-mono text-teal-500 tracking-widest uppercase">{t.tutorial.phase01}</span>
              <div className="h-px flex-1 bg-slate-800 group-hover:bg-teal-500/30 transition-colors"></div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">{t.tutorial.whatIsGame}</h2>
            <p className="text-slate-400 leading-relaxed text-lg">
              {lang === 'ko' ? (
                <>
                  제시된 미스테리한 결말을 보고, <span className="text-teal-400 font-medium">오직 예/아니오 질문</span>만으로 
                  그 이면에 숨겨진 잔혹하거나 기발한 사건의 전말을 파헤치는 수사 게임입니다.
                </>
              ) : (
                <>
                  A detective game where you uncover the cruel or ingenious truth behind a mysterious ending by asking <span className="text-teal-400 font-medium">only yes/no questions</span>.
                </>
              )}
            </p>
          </div>

          {/* 02. 게임 진행 방식 (Step형 UI) */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
              <span className="w-2 h-2 bg-teal-500 rounded-full animate-ping"></span>
              {t.tutorial.investigationProcess}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: '01', title: t.tutorial.step01, desc: t.tutorial.step01Desc },
                { step: '02', title: t.tutorial.step02, desc: t.tutorial.step02Desc },
                { step: '03', title: t.tutorial.step03, desc: t.tutorial.step03Desc },
              ].map((item, i) => (
                <div key={i} className="relative p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
                  <span className="text-4xl font-black text-slate-700/30 absolute top-4 right-4">{item.step}</span>
                  <h3 className="font-bold text-teal-400 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 03. 클래식 예시 (하이라이트 카드) */}
          <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-teal-950/20 to-slate-900 p-8 sm:p-12">
            <div className="absolute top-0 right-0 p-4">
              <i className="ri-double-quotes-r text-6xl text-teal-500/10"></i>
            </div>
            <h2 className="text-xl font-semibold text-teal-400 mb-6 uppercase tracking-wider">{t.tutorial.classicCase}</h2>
            <blockquote className="text-2xl sm:text-3xl font-medium text-white leading-snug mb-8">
              "{t.tutorial.classicExample}"
            </blockquote>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              {t.tutorial.hint}
            </div>
          </div>

        </section>

        {/* 하단 액션 버튼: 가독성과 클릭 영역 확대 */}
        <footer className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/${lang}/create-room`} className="group">
            <div className="h-full p-1 rounded-2xl bg-gradient-to-r from-teal-500 to-blue-600 transition-transform group-hover:scale-[1.02] active:scale-[0.98]">
              <div className="flex items-center justify-center h-full bg-[#050b14] rounded-[14px] px-8 py-4 transition-colors group-hover:bg-transparent">
                <span className="font-bold text-white group-hover:text-white transition-colors">{t.tutorial.startMultiplayer}</span>
              </div>
            </div>
          </Link>
          <Link href={`/${lang}/problems`} className="group">
            <div className="h-full p-1 rounded-2xl bg-slate-800 transition-transform group-hover:scale-[1.02] active:scale-[0.98] border border-slate-700">
              <div className="flex items-center justify-center h-full px-8 py-4 transition-colors">
                <span className="font-bold text-slate-300 group-hover:text-white transition-colors">{t.tutorial.playAlone}</span>
              </div>
            </div>
          </Link>
        </footer>
      </div>
    </div>
  );
}

