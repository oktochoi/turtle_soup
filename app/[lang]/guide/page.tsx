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
                {isKo ? '멀티플레이어 게임' : 'Multiplayer Games'}
              </h2>
              <p className="mb-6 text-slate-300">
                {isKo
                  ? '친구들과 함께 실시간으로 즐길 수 있는 다양한 멀티플레이어 게임을 제공합니다.'
                  : 'We offer various multiplayer games that you can enjoy in real-time with friends.'}
              </p>

              {/* 바다거북스프 */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-teal-300 mb-3 flex items-center gap-2">
                  <i className="ri-bowl-line"></i>
                  {isKo ? '바다거북스프' : 'Turtle Soup'}
                </h3>
                <p className="text-slate-300 mb-4">
                  {isKo
                    ? 'Yes/No 질문을 통해 진실을 추리하는 클래식한 추리 게임입니다.'
                    : 'A classic deduction game where you deduce the truth through Yes/No questions.'}
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-sm text-slate-300">
                  <li>
                    {isKo
                      ? '호스트가 방을 만들고 이야기와 정답을 입력합니다.'
                      : 'The host creates a room and enters a story and answer.'}
                  </li>
                  <li>
                    {isKo
                      ? '플레이어들은 방 코드로 참여하여 예/아니오/상관없음 질문을 합니다.'
                      : 'Players join with a room code and ask yes/no/irrelevant questions.'}
                  </li>
                  <li>
                    {isKo
                      ? '호스트가 질문에 답변하고, 플레이어들은 정답을 추측합니다.'
                      : 'The host answers questions and players guess the answer.'}
                  </li>
                  <li>
                    {isKo
                      ? '정답을 맞추면 게임이 종료되고 진실이 공개됩니다.'
                      : 'When someone guesses correctly, the game ends and the truth is revealed.'}
                  </li>
                </ol>

                {/* 바다거북스프 잘 푸는 법 */}
                <div className="mt-6 pt-6 border-t border-slate-600">
                  <h4 className="text-lg font-bold text-teal-300 mb-4">
                    {isKo ? '바다거북스프 잘 푸는 법' : 'How to Solve Turtle Soup Effectively'}
                  </h4>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '바다거북스프는 단순히 떠오르는 질문을 던지는 게임이 아니라, 정보를 체계적으로 좁혀가는 추리 게임이다. 처음 문제를 접하면 대부분 이야기의 분위기나 공포 요소에 집중하지만, 실제로 중요한 것은 상황을 구성하는 핵심 요소들을 분리해서 확인하는 것이다. 장소, 등장인물, 시간, 행동 순서라는 네 가지 기본 축을 먼저 정리하는 것이 중요하다.'
                      : 'Turtle Soup is not a game of asking random questions—it\'s a deduction game where you systematically narrow down information. When first encountering a problem, most people focus on the atmosphere or horror elements, but what really matters is separating and verifying the core elements that make up the situation. Organizing the four basic axes—location, characters, time, and order of actions—is crucial from the start.'}
                  </p>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '예를 들어 "그는 방에 있었다"라는 문장이 있다면, 그 방이 실내인지 실외인지, 특정 공간인지 임시 장소인지부터 확인해야 한다. 많은 문제는 사람들이 자연스럽게 떠올리는 공간 이미지를 뒤집는 방식으로 설계된다. 등장인물 역시 사람인지, 생물인지, 혹은 무생물에 가까운 존재인지 확인하는 질문이 필요하다.'
                      : 'For example, if there\'s a sentence like "He was in a room," you need to first confirm whether that room is indoor or outdoor, a specific space or a temporary place. Many puzzles are designed to flip the spatial images people naturally imagine. For characters, you need questions to verify whether they\'re human, living beings, or closer to inanimate objects.'}
                  </p>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '또한 초반에는 세부적인 감정이나 이유보다 "사실 관계"를 먼저 좁히는 것이 좋다. 왜 울었는지를 묻기 전에, 무엇을 보았는지, 무엇이 실제로 일어났는지를 확인해야 한다. 정보가 충분히 모이지 않은 상태에서 결론을 추측하면 오히려 추리가 꼬이기 쉽다.'
                      : 'Also, in the early stages, it\'s better to narrow down "factual relationships" before asking about specific emotions or reasons. Before asking why someone cried, confirm what they saw and what actually happened. Guessing conclusions before enough information is gathered tends to derail your deduction.'}
                  </p>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '마지막으로, 좋은 플레이어는 질문을 통해 하나의 가설을 검증한다. 무작위 질문을 던지기보다는 "이 상황이 맞다면 이런 답이 나와야 한다"는 가설을 세우고 확인하는 방식이 훨씬 효율적이다. 바다거북스프는 감이 아니라 논리로 풀수록 재미가 커지는 게임이다.'
                      : 'Finally, good players verify one hypothesis through their questions. Rather than asking random questions, setting up a hypothesis like "if this situation is correct, this answer should follow" and then confirming it is much more efficient. Turtle Soup is a game that gets more fun the more you solve it with logic rather than intuition.'}
                  </p>

                  <h5 className="text-base font-semibold text-teal-400 mb-2 mt-6">
                    {isKo ? '질문 설계 요령' : 'Question Design Tips'}
                  </h5>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '바다거북스프에서 질문은 단순한 호기심 표현이 아니라 추리를 전진시키는 도구다. 좋은 질문은 항상 여러 가능성을 동시에 줄여준다. 가장 기본적인 원칙은 "예/아니오로 명확히 갈리는 질문"을 만드는 것이다. 초반에는 넓은 범위를 커버하는 질문이 효과적이다. 예를 들어 "이 사건은 실내에서 일어났나요?", "등장인물은 혼자였나요?" 같은 질문은 한 번에 많은 경우의 수를 제거해준다.'
                      : 'In Turtle Soup, questions are tools to advance your deduction, not mere expressions of curiosity. Good questions always reduce multiple possibilities at once. The most basic principle is making questions that clearly divide into yes/no. In the early stages, questions that cover a wide range are effective.'}
                  </p>

                  <h5 className="text-base font-semibold text-teal-400 mb-2 mt-6">
                    {isKo ? '힌트 활용법' : 'How to Use Hints'}
                  </h5>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '힌트는 막혔을 때 쓰는 최후의 수단처럼 보이지만, 사실 전략적으로 사용하면 추리를 더 재미있게 만들어준다. 대부분의 퍼즐은 특정 핵심 단서를 중심으로 돌아간다. 힌트는 그 단서의 방향을 알려주는 역할을 한다. 힌트를 하나 사용한 뒤에는 반드시 새로운 질문을 여러 개 만들어보는 것이 중요하다.'
                      : 'Hints may seem like a last resort when you\'re stuck, but they actually make deduction more enjoyable when used strategically. Most puzzles revolve around a specific key clue. Hints play the role of pointing you in the direction of that clue. After using one hint, it\'s important to definitely create several new questions.'}
                  </p>

                  <h5 className="text-base font-semibold text-teal-400 mb-2 mt-6">
                    {isKo ? '초보자 실수 모음' : 'Common Beginner Mistakes'}
                  </h5>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '많은 초보 플레이어들이 처음 떠오른 해석에 집착한다. 문제를 읽자마자 유령 이야기나 범죄 사건으로 단정해버리면, 그 틀에서 벗어나기 어려워진다. 또 너무 세부적인 질문부터 시작하는 것, 감정에 집중하는 것, 질문 기록을 정리하지 않는 것도 흔한 오류다.'
                      : 'Many beginner players cling to their first interpretation. If you conclude it\'s a ghost story or crime case as soon as you read the problem, it becomes hard to escape that framework. Starting with overly specific questions, focusing on emotions, and not organizing question records are also common errors.'}
                  </p>

                  <h5 className="text-base font-semibold text-teal-400 mb-2 mt-6">
                    {isKo ? '문제 만들기 팁' : 'Problem Creation Tips'}
                  </h5>
                  <p className="text-slate-300 text-sm mb-4">
                    {isKo
                      ? '좋은 바다거북스프 문제는 단순히 충격적인 결말이 아니라, 논리적으로 성립하는 구조를 가지고 있어야 한다. 대부분의 명작 퍼즐은 "착각"을 중심으로 설계된다. 공간에 대한 착각, 대상에 대한 착각, 시간 순서에 대한 착각 등이 대표적이다. 문제 설명은 가능한 한 짧고 중립적으로 작성하는 것이 좋다.'
                      : 'A good Turtle Soup problem should have a logically sound structure, not just a shocking conclusion. Most masterpiece puzzles are designed around "misconceptions." Misconceptions about space, about the subject, about the order of time—these are representative. Problem descriptions should be written as briefly and neutrally as possible.'}
                  </p>
                </div>
              </div>

              {/* 라이어 게임 */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <i className="ri-user-unfollow-line"></i>
                  {isKo ? '라이어 게임' : 'Liar Game'}
                </h3>
                <p className="text-slate-300 mb-4">
                  {isKo
                    ? '한 명의 라이어를 찾아내는 심리전 게임입니다.'
                    : 'A psychological game where you find the liar among players.'}
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-sm text-slate-300">
                  <li>
                    {isKo
                      ? '호스트가 게임 주제와 규칙을 설정합니다.'
                      : 'The host sets the game topic and rules.'}
                  </li>
                  <li>
                    {isKo
                      ? '플레이어 중 한 명이 라이어로 지정됩니다 (라이어는 자신이 라이어인지 모릅니다).'
                      : 'One player is designated as the liar (the liar doesn\'t know they are the liar).'}
                  </li>
                  <li>
                    {isKo
                      ? '플레이어들은 주제에 대해 질문하고 답변하며 라이어를 찾아냅니다.'
                      : 'Players ask and answer questions about the topic to find the liar.'}
                  </li>
                  <li>
                    {isKo
                      ? '라이어를 찾아내거나 라이어가 살아남으면 게임이 종료됩니다.'
                      : 'The game ends when the liar is found or survives.'}
                  </li>
                </ol>
              </div>

              {/* 마피아 */}
              <div className="mb-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-red-300 mb-3 flex items-center gap-2">
                  <i className="ri-sword-line"></i>
                  {isKo ? '마피아' : 'Mafia'}
                </h3>
                <p className="text-slate-300 mb-4">
                  {isKo
                    ? '마피아와 시민의 대결을 그린 심리 추리 게임입니다.'
                    : 'A psychological deduction game depicting the battle between mafia and citizens.'}
                </p>
                <ol className="list-decimal pl-6 space-y-2 text-sm text-slate-300">
                  <li>
                    {isKo
                      ? '호스트가 게임 설정과 역할을 배정합니다.'
                      : 'The host sets up the game and assigns roles.'}
                  </li>
                  <li>
                    {isKo
                      ? '플레이어들은 마피아와 시민으로 나뉩니다.'
                      : 'Players are divided into mafia and citizens.'}
                  </li>
                  <li>
                    {isKo
                      ? '밤에는 마피아가 활동하고, 낮에는 시민들이 토론하여 마피아를 찾습니다.'
                      : 'Mafia acts at night, and citizens discuss during the day to find the mafia.'}
                  </li>
                  <li>
                    {isKo
                      ? '마피아를 모두 찾거나 마피아가 시민 수를 넘으면 게임이 종료됩니다.'
                      : 'The game ends when all mafia are found or mafia outnumber citizens.'}
                  </li>
                </ol>
              </div>
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

