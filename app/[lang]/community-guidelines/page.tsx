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
  const baseUrl = `${siteUrl}/${locale}/community-guidelines`;

  return {
    title: locale === 'ko' ? '커뮤니티 가이드라인' : 'Community Guidelines',
    description: locale === 'ko'
      ? '바다거북스프 커뮤니티 가이드라인입니다. 모든 사용자가 안전하고 즐거운 환경에서 게임을 즐길 수 있도록 함께 지켜주세요.'
      : 'Community Guidelines for Pelican Soup Riddle. Please help us maintain a safe and enjoyable environment for all users.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/community-guidelines`,
        en: `${siteUrl}/en/community-guidelines`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '커뮤니티 가이드라인' : 'Community Guidelines',
      description: locale === 'ko'
        ? '바다거북스프 커뮤니티 가이드라인'
        : 'Community Guidelines for Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function CommunityGuidelinesPage({
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
            {isKo ? '커뮤니티 가이드라인' : 'Community Guidelines'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '최종 업데이트' : 'Last updated'}: {lastUpdated}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <p className="mb-4 text-lg">
                {isKo
                  ? '바다거북스프는 모든 사용자가 안전하고 즐거운 환경에서 게임을 즐길 수 있도록 노력하고 있습니다. 아래 가이드라인을 준수해 주시기 바랍니다.'
                  : 'Pelican Soup Riddle strives to provide a safe and enjoyable environment for all users. Please follow the guidelines below.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '1. 금지 행위' : '1. Prohibited Acts'}
              </h2>
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '욕설 및 비방' : 'Profanity and Defamation'}
                  </h3>
                  <p>
                    {isKo
                      ? '다른 사용자에 대한 욕설, 비방, 모욕, 협박, 괴롭힘은 절대 금지됩니다. 인종, 종교, 성별, 성적 지향성 등에 대한 차별적 발언도 금지됩니다.'
                      : 'Profanity, defamation, insults, threats, and harassment against other users are strictly prohibited. Discriminatory remarks regarding race, religion, gender, sexual orientation, etc. are also prohibited.'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '성인 콘텐츠' : 'Adult Content'}
                  </h3>
                  <p>
                    {isKo
                      ? '성적인 내용, 노골적인 표현, 성인물은 금지됩니다. 모든 연령대가 이용할 수 있는 환경을 유지해야 합니다.'
                      : 'Sexual content, explicit expressions, and adult materials are prohibited. We must maintain an environment accessible to all ages.'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '폭력 및 혐오 표현' : 'Violence and Hate Speech'}
                  </h3>
                  <p>
                    {isKo
                      ? '폭력적인 내용, 혐오 표현, 자해 또는 자살 관련 내용은 금지됩니다.'
                      : 'Violent content, hate speech, and content related to self-harm or suicide are prohibited.'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '스팸 및 광고' : 'Spam and Advertising'}
                  </h3>
                  <p>
                    {isKo
                      ? '스팸 메시지, 무단 광고, 다른 사이트로의 링크 유도는 금지됩니다.'
                      : 'Spam messages, unauthorized advertising, and links to other sites are prohibited.'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '저작권 침해' : 'Copyright Infringement'}
                  </h3>
                  <p>
                    {isKo
                      ? '타인의 저작권을 침해하는 콘텐츠(문제, 댓글, 게시글 등)는 금지됩니다. 자신이 만든 원작 콘텐츠만 공유해 주세요.'
                      : 'Content (problems, comments, posts, etc.) that infringes on others\' copyrights is prohibited. Please only share original content you created.'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-red-400 mb-3">
                    <i className="ri-forbid-line mr-2"></i>
                    {isKo ? '부정행위' : 'Cheating'}
                  </h3>
                  <p>
                    {isKo
                      ? '게임 시스템을 악용하거나 부정한 방법으로 점수를 획득하는 행위는 금지됩니다.'
                      : 'Abusing the game system or obtaining scores through unfair methods is prohibited.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '2. 신고 기능' : '2. Reporting Function'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '위반 사항을 발견하셨다면 신고 기능을 이용해 주세요. 신고된 내용은 관리자가 검토하여 적절한 조치를 취합니다.'
                  : 'If you find any violations, please use the reporting function. Reported content will be reviewed by administrators and appropriate action will be taken.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '문제, 댓글, 게시글, 사용자 프로필에서 신고 버튼을 클릭할 수 있습니다.'
                    : 'You can click the report button on problems, comments, posts, and user profiles.'}
                </li>
                <li>
                  {isKo
                    ? '신고 시 구체적인 사유를 선택하고 필요시 추가 설명을 작성해 주세요.'
                    : 'When reporting, select a specific reason and write additional explanations if necessary.'}
                </li>
                <li>
                  {isKo
                    ? '허위 신고는 신고자에게 불이익을 줄 수 있습니다.'
                    : 'False reports may result in disadvantages for the reporter.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '3. 제재 조치' : '3. Disciplinary Actions'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '가이드라인을 위반한 경우 다음과 같은 제재 조치가 취해질 수 있습니다.'
                  : 'If guidelines are violated, the following disciplinary actions may be taken.'}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-yellow-400 mb-1">
                    {isKo ? '1차 경고' : 'First Warning'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '경미한 위반 사항의 경우 경고 메시지를 발송합니다.'
                      : 'For minor violations, a warning message is sent.'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-orange-400 mb-1">
                    {isKo ? '콘텐츠 삭제/블라인드' : 'Content Deletion/Blind'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '위반 콘텐츠는 즉시 삭제되거나 블라인드 처리됩니다.'
                      : 'Violating content is immediately deleted or blinded.'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-red-400 mb-1">
                    {isKo ? '일시적 이용 제한' : 'Temporary Usage Restriction'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '반복적인 위반 시 일정 기간 동안 서비스 이용이 제한될 수 있습니다.'
                      : 'Repeated violations may result in service usage restrictions for a certain period.'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-red-500 mb-1">
                    {isKo ? '영구 계정 정지' : 'Permanent Account Suspension'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '심각한 위반이나 반복적인 위반의 경우 계정이 영구적으로 정지될 수 있습니다.'
                      : 'In case of serious violations or repeated violations, the account may be permanently suspended.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '4. 건전한 커뮤니티를 위한 권장 사항' : '4. Recommendations for a Healthy Community'}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '다른 사용자를 존중하고 배려하는 마음으로 소통하세요.'
                    : 'Communicate with respect and consideration for other users.'}
                </li>
                <li>
                  {isKo
                    ? '건설적인 피드백과 토론을 장려합니다.'
                    : 'We encourage constructive feedback and discussion.'}
                </li>
                <li>
                  {isKo
                    ? '다양한 의견을 존중하고, 다른 관점을 이해하려고 노력하세요.'
                    : 'Respect diverse opinions and try to understand different perspectives.'}
                </li>
                <li>
                  {isKo
                    ? '게임의 재미를 해치지 않는 선에서 즐겁게 플레이하세요.'
                    : 'Play enjoyably without harming the fun of the game.'}
                </li>
                <li>
                  {isKo
                    ? '새로운 사용자들을 환영하고 도와주세요.'
                    : 'Welcome and help new users.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '5. 문의 및 제안' : '5. Inquiries and Suggestions'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '가이드라인에 대한 문의나 개선 제안이 있으시면 언제든지 연락해 주세요.'
                  : 'If you have any inquiries or suggestions for improvement regarding the guidelines, please feel free to contact us.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-400 border border-teal-500/50 rounded-lg hover:bg-teal-500/30 transition-colors"
                >
                  <i className="ri-mail-line"></i>
                  <span>{isKo ? '문의하기' : 'Contact Us'}</span>
                </Link>
              </div>
            </section>

            <section className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '함께 만들어가는 건강한 커뮤니티' : 'Building a Healthy Community Together'}
              </h2>
              <p>
                {isKo
                  ? '바다거북스프는 모든 사용자가 즐겁고 안전하게 게임을 즐길 수 있는 커뮤니티를 만들기 위해 노력하고 있습니다. 여러분의 협조와 참여가 필요합니다. 함께 건전한 게임 환경을 만들어 나가요!'
                  : 'Pelican Soup Riddle strives to create a community where all users can enjoy the game happily and safely. We need your cooperation and participation. Let\'s build a healthy gaming environment together!'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

