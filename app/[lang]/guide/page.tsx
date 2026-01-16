import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AdNativeBanner from '@/components/ads/AdNativeBanner';
import AdBanner300x250 from '@/components/ads/AdBanner300x250';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/guide`;

  return {
    title: locale === 'ko' ? '게임 이용 가이드' : 'Game Guide',
    description: locale === 'ko'
      ? '바다거북스프 게임 플레이 방법을 자세히 알아보세요. 멀티플레이어와 오프라인 모드 모두 지원합니다.'
      : 'Learn how to play Pelican Soup Riddle in detail. Both multiplayer and offline modes are supported.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/guide`,
        en: `${siteUrl}/en/guide`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '게임 이용 가이드' : 'Game Guide',
      description: locale === 'ko'
        ? '바다거북스프 게임 가이드'
        : 'Pelican Soup Riddle Game Guide',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function GuidePage({
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
  const lastUpdated = '2025-01-17';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '게임 이용 가이드' : 'Game Guide'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '최종 업데이트' : 'Last updated'}: {lastUpdated}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 소개' : 'Game Introduction'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '바다거북스프는 추리와 질문을 통해 진실을 밝혀내는 게임입니다. 호스트가 설정한 이야기와 진실을 플레이어들이 질문을 통해 추리합니다.'
                  : 'Pelican Soup Riddle is a game where you uncover the truth through deduction and questions. Players deduce the story and truth set by the host through questions.'}
              </p>
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm">
                  <strong className="text-teal-300">{isKo ? '예시' : 'Example'}:</strong>{' '}
                  {isKo
                    ? '이야기: "한 남자가 바다에 빠졌다. 구조대가 왔지만 그를 구하지 못했다."'
                    : 'Story: "A man fell into the sea. The rescue team came but could not save him."'}
                </p>
                <p className="text-sm mt-2">
                  {isKo
                    ? '진실: "그 남자는 잠수부였고, 바다 속에서 작업 중이었다."'
                    : 'Truth: "The man was a diver and was working underwater."'}
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '멀티플레이어 모드' : 'Multiplayer Mode'}
              </h2>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  <strong className="text-teal-300">{isKo ? '방 만들기' : 'Create Room'}:</strong>{' '}
                  {isKo
                    ? '호스트가 방을 만들고 이야기와 진실을 입력합니다. 비밀번호를 설정하여 비공개 방을 만들 수도 있습니다.'
                    : 'The host creates a room and enters a story and truth. You can also create a private room by setting a password.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '방 참여' : 'Join Room'}:</strong>{' '}
                  {isKo
                    ? '다른 플레이어들은 방 코드를 입력하여 참여합니다. 비밀번호가 설정된 방의 경우 비밀번호도 입력해야 합니다.'
                    : 'Other players join by entering the room code. If a password is set for the room, the password must also be entered.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '질문하기' : 'Ask Questions'}:</strong>{' '}
                  {isKo
                    ? '플레이어들은 예/아니오/상관없음으로 답변 가능한 질문을 할 수 있습니다. 예: "그 남자는 수영을 할 수 있었나요?"'
                    : 'Players can ask questions that can be answered with yes/no/irrelevant. Example: "Could the man swim?"'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '답변하기' : 'Answer Questions'}:</strong>{' '}
                  {isKo
                    ? '호스트는 각 질문에 대해 예/아니오/상관없음으로 답변합니다.'
                    : 'The host answers each question with yes/no/irrelevant.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '정답 추측' : 'Guess the Answer'}:</strong>{' '}
                  {isKo
                    ? '플레이어들은 충분한 질문을 한 후 진실을 추측하여 제출할 수 있습니다.'
                    : 'After asking enough questions, players can guess and submit the truth.'}
                </li>
                <li>
                  <strong className="text-teal-300">{isKo ? '게임 종료' : 'End Game'}:</strong>{' '}
                  {isKo
                    ? '호스트가 정답을 확인하면 게임이 종료되고 진실이 공개됩니다.'
                    : 'When the host confirms the answer, the game ends and the truth is revealed.'}
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '오프라인 모드' : 'Offline Mode'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '혼자서 게임을 즐기고 싶다면 오프라인 모드를 이용할 수 있습니다.'
                  : 'If you want to enjoy the game alone, you can use offline mode.'}
              </p>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  {isKo
                    ? '문제 목록에서 원하는 문제를 선택합니다.'
                    : 'Select a problem from the problem list.'}
                </li>
                <li>
                  {isKo
                    ? '문제 내용을 읽고 질문을 통해 진실을 추리합니다.'
                    : 'Read the problem content and deduce the truth through questions.'}
                </li>
                <li>
                  {isKo
                    ? 'AI가 질문에 자동으로 답변해줍니다.'
                    : 'AI automatically answers your questions.'}
                </li>
                <li>
                  {isKo
                    ? '정답을 추측하여 제출하고 결과를 확인합니다.'
                    : 'Guess and submit the answer and check the results.'}
                </li>
              </ol>
            </section>

            {/* 광고: 오프라인 모드 후 */}
            <div className="my-6 sm:my-8">
              <AdNativeBanner
                position="guide-after-offline"
                className="w-full max-w-md mx-auto"
                cardStyle={true}
              />
            </div>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '문제 생성하기' : 'Creating Problems'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '자신만의 추리 문제를 만들어 다른 플레이어들과 공유할 수 있습니다.'
                  : 'You can create your own deduction problems and share them with other players.'}
              </p>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  {isKo
                    ? '문제 생성 페이지로 이동합니다.'
                    : 'Go to the problem creation page.'}
                </li>
                <li>
                  {isKo
                    ? '문제 제목, 내용, 정답을 입력합니다.'
                    : 'Enter the problem title, content, and answer.'}
                </li>
                <li>
                  {isKo
                    ? '선택적으로 힌트를 추가할 수 있습니다.'
                    : 'You can optionally add hints.'}
                </li>
                <li>
                  {isKo
                    ? '문제를 저장하면 다른 플레이어들이 플레이할 수 있습니다.'
                    : 'When you save the problem, other players can play it.'}
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 팁' : 'Game Tips'}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '질문은 구체적이고 명확하게 작성하세요. 모호한 질문은 답변하기 어렵습니다.'
                    : 'Write questions specifically and clearly. Vague questions are difficult to answer.'}
                </li>
                <li>
                  {isKo
                    ? '이야기의 맥락을 고려하여 질문하세요. 관련 없는 질문은 "상관없음"으로 답변될 수 있습니다.'
                    : 'Ask questions considering the context of the story. Unrelated questions may be answered as "irrelevant."'}
                </li>
                <li>
                  {isKo
                    ? '여러 각도에서 질문해보세요. 한 가지 관점만으로는 진실을 찾기 어렵습니다.'
                    : 'Ask questions from multiple angles. It is difficult to find the truth from only one perspective.'}
                </li>
                <li>
                  {isKo
                    ? '다른 플레이어들의 질문과 답변을 주의 깊게 관찰하세요. 힌트가 될 수 있습니다.'
                    : 'Carefully observe other players\' questions and answers. They can be hints.'}
                </li>
                <li>
                  {isKo
                    ? '서두르지 마세요. 충분한 질문을 한 후 정답을 추측하는 것이 좋습니다.'
                    : 'Don\'t rush. It\'s better to guess the answer after asking enough questions.'}
                </li>
              </ul>
            </section>

            {/* 광고: 게임 팁 후 */}
            <div className="my-6 sm:my-8">
              <AdNativeBanner
                position="guide-after-tips"
                className="w-full max-w-md mx-auto"
                cardStyle={true}
              />
            </div>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '랭킹 시스템' : 'Ranking System'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '문제를 해결하거나 좋아요를 받으면 랭킹에 반영됩니다.'
                  : 'Solving problems or receiving likes will be reflected in the rankings.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '문제 해결 랭킹: 정답을 맞춘 문제 수를 기준으로 랭킹이 결정됩니다.'
                    : 'Problem solving ranking: Rankings are determined based on the number of problems solved correctly.'}
                </li>
                <li>
                  {isKo
                    ? '좋아요 랭킹: 자신이 만든 문제에 받은 좋아요 수를 기준으로 랭킹이 결정됩니다.'
                    : 'Like ranking: Rankings are determined based on the number of likes received on problems you created.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '출석체크 및 경험치' : 'Check-in and Experience Points'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '매일 출석체크를 하면 경험치와 포인트를 받을 수 있습니다.'
                  : 'You can earn experience points and points by checking in every day.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '출석체크는 하루에 한 번만 가능합니다.'
                    : 'Check-in is only possible once a day.'}
                </li>
                <li>
                  {isKo
                    ? '경험치를 쌓으면 레벨이 올라갑니다.'
                    : 'Your level increases as you accumulate experience points.'}
                </li>
                <li>
                  {isKo
                    ? '문제 해결, 댓글 작성, 게시글 작성 등 다양한 활동으로 경험치를 얻을 수 있습니다.'
                    : 'You can earn experience points through various activities such as solving problems, writing comments, and creating posts.'}
                </li>
              </ul>
            </section>

            {/* 광고: 출석체크 및 경험치 후 */}
            <div className="my-6 sm:my-8">
              <div className="flex flex-col items-center gap-4">
                <AdNativeBanner
                  position="guide-after-xp"
                  className="w-full max-w-md"
                  cardStyle={true}
                />
                <div className="hidden sm:block">
                  <AdBanner300x250 position="guide-after-xp" />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700">
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/tutorial`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-400 border border-teal-500/50 rounded-lg hover:bg-teal-500/30 transition-colors"
                >
                  <i className="ri-play-circle-line"></i>
                  <span>{isKo ? '튜토리얼 보기' : 'View Tutorial'}</span>
                </Link>
                <Link
                  href={`/${locale}/problems`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
                >
                  <i className="ri-question-answer-line"></i>
                  <span>{isKo ? '문제 목록' : 'Problem List'}</span>
                </Link>
                <Link
                  href={`/${locale}/create-room`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/30 transition-colors"
                >
                  <i className="ri-group-line"></i>
                  <span>{isKo ? '방 만들기' : 'Create Room'}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

