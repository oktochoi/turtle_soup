'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function TutorialPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const lang = resolvedParams.lang || 'ko';
  const t = useTranslations();
  const isKo = lang === 'ko';

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
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <i className="ri-bowl-line text-teal-400"></i>
              {isKo ? '바다거북스프' : 'Turtle Soup'}
            </h2>
            <p className="text-slate-400 leading-relaxed text-lg mb-4">
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
            <p className="text-slate-400 leading-relaxed mb-4">
              {isKo
                ? '바다거북스프는 단순히 떠오르는 질문을 던지는 게임이 아니라, 정보를 체계적으로 좁혀가는 추리 게임입니다. 장소, 등장인물, 시간, 행동 순서라는 네 가지 기본 축을 먼저 정리하는 것이 중요합니다. 초반에는 세부적인 감정이나 이유보다 "사실 관계"를 먼저 좁히고, 가설을 세운 뒤 질문으로 검증하는 방식이 효율적입니다.'
                : 'Turtle Soup is not a game of asking random questions—it\'s a deduction game where you systematically narrow down information. Organizing the four basic axes—location, characters, time, and order of actions—is crucial. In the early stages, narrow down "factual relationships" before emotions or reasons, then set hypotheses and verify them through questions.'}
            </p>
            <p className="text-slate-400 leading-relaxed text-sm">
              {isKo
                ? '호스트가 이야기와 진실을 설정하면, 플레이어들은 예/아니오/상관없음으로 답할 수 있는 질문만 할 수 있습니다. 정답을 맞추면 게임이 종료되고 진실이 공개됩니다.'
                : 'The host sets the story and truth, and players can only ask questions answerable with yes/no/irrelevant. When someone guesses correctly, the game ends and the truth is revealed.'}
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
            <blockquote className="text-2xl sm:text-3xl font-medium text-white leading-snug mb-6">
              &quot;{t.tutorial.classicExample}&quot;
            </blockquote>
            <p className="text-slate-400 text-sm mb-6">
              {isKo
                ? '진실: 그 남자는 오래전에 바다에서 실종된 아들을 찾고 있었다. 수프를 먹으며 아들의 유골이 들어있다는 사실을 깨달았다.'
                : 'Truth: The man had been searching for his son who went missing at sea long ago. He realized while eating the soup that his son\'s remains were in it.'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              {t.tutorial.hint}
            </div>
          </div>

          {/* 04. 다른 게임들 소개 */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
              <i className="ri-gamepad-line text-purple-400"></i>
              {isKo ? '다른 게임들' : 'Other Games'}
            </h2>
            <p className="text-slate-400 mb-8">
              {isKo
                ? '바다거북스프 플랫폼에서는 추리 게임 외에도 다양한 멀티플레이어 게임을 즐길 수 있습니다.'
                : 'The Turtle Soup platform offers various multiplayer games in addition to deduction games.'}
            </p>

            <div className="space-y-6">
              {/* 라이어 게임 */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                <h3 className="text-xl font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <i className="ri-user-unfollow-line"></i>
                  {isKo ? '라이어 게임' : 'Liar Game'}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {isKo
                    ? '한 명의 라이어를 찾아내는 심리전 게임입니다. 호스트가 게임 주제(예: 직업, 취미)를 정하면, 플레이어 중 한 명이 몰래 라이어로 지정됩니다. 라이어는 자신이 라이어인지 모릅니다. 모든 플레이어가 주제에 대해 한 문장씩 말할 때, 라이어만 다른 정보를 말하게 됩니다. 플레이어들은 서로의 발언을 분석하여 라이어를 지목하고, 라이어를 찾아내거나 라이어가 살아남으면 게임이 종료됩니다.'
                    : 'A psychological game where you find the liar among players. The host sets a topic (e.g., job, hobby), and one player is secretly designated as the liar—who doesn\'t know they are. When each player says one sentence about the topic, only the liar gives different information. Players analyze each other\'s statements to identify the liar. The game ends when the liar is found or survives.'}
                </p>
                <Link href={`/${lang}/create-room`} className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-medium">
                  {isKo ? '방 만들기' : 'Create Room'}
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>

              {/* 마피아 */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-red-500/30 transition-colors">
                <h3 className="text-xl font-bold text-red-300 mb-3 flex items-center gap-2">
                  <i className="ri-sword-line"></i>
                  {isKo ? '마피아' : 'Mafia'}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {isKo
                    ? '마피아와 시민의 대결을 그린 심리 추리 게임입니다. 밤에는 마피아가 시민을 지목해 제거하고, 낮에는 시민들이 토론하여 마피아로 의심되는 사람을 투표로 처형합니다. 마피아는 자신의 정체를 숨기며 시민을 속여야 하고, 시민들은 마피아를 찾아내야 합니다. 마피아를 모두 찾거나 마피아 수가 시민을 넘으면 게임이 종료됩니다. 말솜씨와 관찰력이 승패를 좌우합니다.'
                    : 'A psychological deduction game depicting the battle between mafia and citizens. At night, mafia eliminate citizens; during the day, citizens discuss and vote to execute suspects. Mafia must hide their identity and deceive citizens, while citizens must find the mafia. The game ends when all mafia are found or mafia outnumber citizens. Eloquence and observation determine victory.'}
                </p>
                <Link href={`/${lang}/create-room`} className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium">
                  {isKo ? '방 만들기' : 'Create Room'}
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>

              {/* 맞추기 게임 */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                <h3 className="text-xl font-bold text-cyan-300 mb-3 flex items-center gap-2">
                  <i className="ri-stack-line"></i>
                  {isKo ? '맞추기 게임' : 'Guess Game'}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {isKo
                    ? '카드 세트로 즐기는 바다거북스프형 퀴즈입니다. 사용자가 만든 카드 세트(제목, 정답, 힌트가 있는 카드 묶음)를 시간 제한 안에 맞추는 게임입니다. 한 장씩 카드를 넘기며 정답을 추측하고, 힌트를 활용해 빠르게 맞추면 높은 점수를 얻습니다. 혼자서 연습하거나 친구들과 대결할 수 있으며, 인기 세트를 플레이하거나 직접 세트를 만들어 공유할 수 있습니다.'
                    : 'A Turtle Soup-style quiz played with card sets. Guess answers within the time limit using user-created card sets (cards with titles, answers, and hints). Flip cards one by one, guess the answer, and use hints to score higher. Practice alone or compete with friends. Play popular sets or create and share your own.'}
                </p>
                <Link href={`/${lang}/guess`} className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-medium">
                  {isKo ? '맞추기 게임 보기' : 'Browse Guess Games'}
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>

              {/* 오프라인 문제 풀기 */}
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:border-teal-500/30 transition-colors">
                <h3 className="text-xl font-bold text-teal-300 mb-3 flex items-center gap-2">
                  <i className="ri-question-answer-line"></i>
                  {isKo ? '오프라인 문제 풀기' : 'Offline Problem Solving'}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {isKo
                    ? '혼자서 바다거북스프 문제를 풀고 싶다면 문제 목록에서 원하는 문제를 선택하세요. AI가 질문에 자동으로 예/아니오/상관없음으로 답변해줍니다. 다양한 난이도와 주제의 문제가 준비되어 있으며, 정답을 추측하여 제출하면 유사도로 채점됩니다. 멀티플레이어 없이도 추리의 재미를 느낄 수 있습니다.'
                    : 'Want to solve Turtle Soup alone? Select a problem from the problem list. AI automatically answers your questions with yes/no/irrelevant. Problems of various difficulties and topics are available. Submit your guess and get scored by similarity. Enjoy deduction without multiplayer.'}
                </p>
                <Link href={`/${lang}/problems`} className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm font-medium">
                  {isKo ? '문제 목록 보기' : 'Browse Problems'}
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
            </div>
          </div>

          {/* 05. 추리 팁 */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <i className="ri-lightbulb-line text-yellow-400"></i>
              {isKo ? '추리 팁' : 'Deduction Tips'}
            </h2>
            <ul className="space-y-4 text-slate-400">
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold shrink-0">1.</span>
                <span>{isKo ? '질문은 "예/아니오"로 명확히 갈리게 만드세요. 애매한 질문은 정보를 주지 못합니다.' : 'Make questions that clearly divide into yes/no. Vague questions give no information.'}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold shrink-0">2.</span>
                <span>{isKo ? '초반에는 넓은 범위를 묻고, 정보가 모이면 구체적으로 좁혀가세요. "실내인가요?", "등장인물은 혼자였나요?" 같은 질문이 효과적입니다.' : 'Ask broad questions first, then narrow down as information accumulates. Questions like "Indoors?" or "Was the character alone?" are effective.'}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold shrink-0">3.</span>
                <span>{isKo ? '가설을 세우고 검증하는 질문을 하세요. "이 상황이 맞다면 이런 답이 나와야 한다"는 식으로.' : 'Set hypotheses and ask verification questions. "If this situation is correct, this answer should follow."'}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold shrink-0">4.</span>
                <span>{isKo ? '처음 떠오른 해석에 집착하지 마세요. 바다거북스프는 가장 자연스러운 해석을 뒤집는 경우가 많습니다.' : 'Don\'t cling to your first interpretation. Turtle Soup often flips the most natural interpretation.'}</span>
              </li>
              <li className="flex gap-3">
                <span className="text-teal-500 font-bold shrink-0">5.</span>
                <span>{isKo ? '감정보다 사실을 묻세요. "무서웠나요?"보다 "무엇을 보았나요?"가 훨씬 유용합니다.' : 'Ask about facts rather than emotions. "What did they see?" is much more useful than "Were they scared?"'}</span>
              </li>
            </ul>
          </div>

        </section>

        {/* 하단 액션 버튼 */}
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

        {/* 가이드 링크 */}
        <div className="mt-8 text-center">
          <Link href={`/${lang}/guide`} className="text-slate-500 hover:text-teal-400 text-sm transition-colors">
            {isKo ? '더 자세한 게임 가이드 보기 →' : 'View detailed game guide →'}
          </Link>
        </div>
      </div>
    </div>
  );
}

