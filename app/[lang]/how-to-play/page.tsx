import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/how-to-play`;

  return {
    title: locale === 'ko' ? '게임 방법' : 'How to Play',
    description: locale === 'ko'
      ? '바다거북스프 게임 플레이 방법을 알아보세요. 추리와 질문으로 진실을 밝혀내는 방법을 단계별로 설명합니다.'
      : 'Learn how to play Pelican Soup Riddle. Step-by-step guide on how to uncover the truth through deduction and questions.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/how-to-play`,
        en: `${siteUrl}/en/how-to-play`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '게임 방법' : 'How to Play',
      description: locale === 'ko'
        ? '바다거북스프 게임 플레이 방법'
        : 'How to Play Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function HowToPlayPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isValidLocale(lang)) {
    notFound();
  }
  const locale = lang as Locale;
  const isKo = locale === 'ko';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '게임 방법' : 'How to Play'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '바다거북스프 게임을 시작하는 방법을 알아보세요' : 'Learn how to start playing Pelican Soup Riddle'}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 기본 개념' : 'Basic Game Concept'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '바다거북스프는 추리와 질문을 통해 진실을 밝혀내는 게임입니다. 한 명의 호스트가 이야기와 진실을 설정하고, 다른 플레이어들은 예/아니오/상관없음으로 답변 가능한 질문을 통해 진실을 추리합니다.'
                  : 'Pelican Soup Riddle is a game where you uncover the truth through deduction and questions. One host sets up a story and truth, and other players deduce the truth through questions that can be answered with yes/no/irrelevant.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '멀티플레이어 모드' : 'Multiplayer Mode'}
              </h2>
              <ol className="list-decimal pl-6 space-y-4">
                <li>
                  <strong className="text-teal-300">{isKo ? '방 만들기' : 'Create Room'}:</strong>{' '}
                  {isKo
                    ? '호스트가 방을 만들고 이야기와 진실을 설정합니다. 방 코드가 생성되면 다른 플레이어들에게 공유하세요.'
                    : 'The host creates a room and sets up a story and truth. Once a room code is generated, share it with other players.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '방 참여하기' : 'Join Room'}:</strong>{' '}
                  {isKo
                    ? '다른 플레이어가 만든 방에 참여하려면 방 코드를 입력하세요. 참여 후 닉네임을 설정하면 게임에 참여할 수 있습니다.'
                    : 'To join a room created by another player, enter the room code. After joining, set your nickname to participate in the game.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '질문하기' : 'Ask Questions'}:</strong>{' '}
                  {isKo
                    ? '플레이어들은 호스트에게 예/아니오/상관없음으로 답변 가능한 질문을 할 수 있습니다. 질문을 통해 진실을 추리하세요.'
                    : 'Players can ask the host questions that can be answered with yes/no/irrelevant. Deduce the truth through questions.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '정답 맞추기' : 'Guess the Answer'}:</strong>{' '}
                  {isKo
                    ? '충분한 정보를 얻었다고 생각되면 정답을 제출할 수 있습니다. 정답을 맞추면 승리합니다!'
                    : 'When you think you have enough information, you can submit your answer. If you guess correctly, you win!'}
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '오프라인 모드' : 'Offline Mode'}
              </h2>
              <ol className="list-decimal pl-6 space-y-4">
                <li>
                  <strong className="text-teal-300">{isKo ? '문제 선택' : 'Select Problem'}:</strong>{' '}
                  {isKo
                    ? '문제 목록에서 원하는 문제를 선택하세요. 다양한 난이도와 주제의 문제가 준비되어 있습니다.'
                    : 'Choose a problem from the problem list. Problems of various difficulties and topics are available.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '문제 읽기' : 'Read Problem'}:</strong>{' '}
                  {isKo
                    ? '문제의 이야기와 상황을 자세히 읽어보세요. 힌트가 될 수 있는 모든 정보를 파악하세요.'
                    : 'Read the story and situation of the problem carefully. Understand all information that could be hints.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '추리하기' : 'Deduce'}:</strong>{' '}
                  {isKo
                    ? '이야기와 상황을 바탕으로 논리적으로 추리하여 정답을 찾아보세요.'
                    : 'Deduce logically based on the story and situation to find the answer.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '정답 확인' : 'Check Answer'}:</strong>{' '}
                  {isKo
                    ? '정답을 입력하고 확인 버튼을 누르면 정답 여부를 확인할 수 있습니다.'
                    : 'Enter your answer and press the check button to see if you are correct.'}
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 팁' : 'Game Tips'}
              </h2>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  {isKo
                    ? '질문은 구체적이고 명확하게 하세요. 모호한 질문은 도움이 되지 않습니다.'
                    : 'Ask questions that are specific and clear. Vague questions are not helpful.'}
                </li>
                <li>
                  {isKo
                    ? '다른 플레이어들의 질문과 답변을 주의 깊게 관찰하세요. 힌트가 될 수 있습니다.'
                    : 'Pay close attention to other players\' questions and answers. They can be hints.'}
                </li>
                <li>
                  {isKo
                    ? '논리적으로 사고하되, 창의적인 발상도 중요합니다. 때로는 예상치 못한 각도에서 접근해야 합니다.'
                    : 'Think logically, but creative thinking is also important. Sometimes you need to approach from an unexpected angle.'}
                </li>
                <li>
                  {isKo
                    ? '시간을 들여 신중하게 생각하세요. 성급한 추측보다는 논리적인 추리가 더 중요합니다.'
                    : 'Take your time and think carefully. Logical deduction is more important than hasty guesses.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '시작하기' : 'Get Started'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '이제 게임을 시작할 준비가 되었습니다! 아래 버튼을 클릭하여 게임을 시작하세요.'
                  : 'You are now ready to start playing! Click the button below to start the game.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/create-room`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500/20 text-teal-400 border border-teal-500/50 rounded-lg hover:bg-teal-500/30 transition-colors"
                >
                  <i className="ri-add-circle-line"></i>
                  <span>{isKo ? '방 만들기' : 'Create Room'}</span>
                </Link>
                <Link
                  href={`/${locale}/play`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
                >
                  <i className="ri-play-line"></i>
                  <span>{isKo ? '게임 시작하기' : 'Start Game'}</span>
                </Link>
                <Link
                  href={`/${locale}/problems`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors"
                >
                  <i className="ri-question-answer-line"></i>
                  <span>{isKo ? '문제 목록' : 'Problem List'}</span>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

