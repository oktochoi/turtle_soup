import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/privacy`;

  return {
    title: locale === 'ko' ? '개인정보처리방침' : 'Privacy Policy',
    description: locale === 'ko'
      ? '바다거북스프 게임의 개인정보처리방침입니다. 개인정보 수집, 이용, 보호에 대한 내용을 확인하세요.'
      : 'Privacy Policy for Pelican Soup Riddle. Learn how we collect, use, and protect your personal information.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/privacy`,
        en: `${siteUrl}/en/privacy`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '개인정보처리방침' : 'Privacy Policy',
      description: locale === 'ko'
        ? '바다거북스프 게임의 개인정보처리방침'
        : 'Privacy Policy for Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function PrivacyPage({
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'okto0914@gmail.com';
  const lastUpdated = '2025-01-17';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '개인정보처리방침' : 'Privacy Policy'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '최종 업데이트' : 'Last updated'}: {lastUpdated}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '1. 개인정보의 처리 목적' : '1. Purpose of Personal Information Processing'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '바다거북스프(이하 "서비스")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.'
                  : 'Pelican Soup Riddle (the "Service") processes personal information for the following purposes. The personal information being processed will not be used for purposes other than those listed below, and if the purpose of use changes, we will take necessary measures such as obtaining separate consent in accordance with Article 18 of the Personal Information Protection Act.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지, 고충처리 등을 목적으로 개인정보를 처리합니다.'
                    : 'Member registration and management: Personal information is processed for the purpose of confirming membership intentions, identifying and authenticating users for membership services, maintaining and managing membership, preventing fraudulent use of services, various notices and notifications, and handling complaints.'}
                </li>
                <li>
                  {isKo
                    ? '게임 서비스 제공: 게임 플레이, 문제 생성, 댓글 작성, 멀티플레이어 방 생성 및 참여, 랭킹 시스템, 출석체크, 경험치 및 포인트 관리 등을 목적으로 개인정보를 처리합니다.'
                    : 'Game service provision: Personal information is processed for the purpose of game play, problem creation, comment writing, multiplayer room creation and participation, ranking system, check-in, experience points and points management.'}
                </li>
                <li>
                  {isKo
                    ? '마케팅 및 광고 활용: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공, 서비스의 유효성 확인, 접속빈도 파악 또는 회원의 서비스 이용에 대한 통계 등을 목적으로 개인정보를 처리합니다.'
                    : 'Marketing and advertising: Personal information is processed for the purpose of developing new services and providing customized services, providing event and advertising information and participation opportunities, verifying service effectiveness, understanding access frequency, or statistics on member service use.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '2. 개인정보의 처리 및 보유기간' : '2. Processing and Retention Period of Personal Information'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.'
                  : 'The Service processes and retains personal information within the period of retention and use of personal information in accordance with laws and regulations or the period of retention and use of personal information agreed upon when collecting personal information from the information subject.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '회원 가입 및 관리: 회원 탈퇴 시까지 (단, 관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료 시까지)'
                    : 'Member registration and management: Until membership withdrawal (However, if an investigation or inquiry is in progress due to violation of related laws, until the end of such investigation or inquiry)'}
                </li>
                <li>
                  {isKo
                    ? '게임 서비스 제공: 회원 탈퇴 시까지'
                    : 'Game service provision: Until membership withdrawal'}
                </li>
                <li>
                  {isKo
                    ? '마케팅 및 광고 활용: 회원 탈퇴 시까지 또는 동의 철회 시까지'
                    : 'Marketing and advertising: Until membership withdrawal or consent withdrawal'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '3. 처리하는 개인정보의 항목' : '3. Items of Personal Information Processed'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 다음의 개인정보 항목을 처리하고 있습니다.'
                  : 'The Service processes the following personal information items.'}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-teal-300 mb-2">
                  {isKo ? '필수항목' : 'Required Items'}
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>{isKo ? '이메일 주소 (Google 로그인 시)' : 'Email address (when using Google login)'}</li>
                  <li>{isKo ? '닉네임' : 'Nickname'}</li>
                  <li>{isKo ? '게임 사용자 ID' : 'Game user ID'}</li>
                </ul>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-teal-300 mb-2">
                  {isKo ? '자동 수집 항목' : 'Automatically Collected Items'}
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>{isKo ? 'IP 주소, 쿠키, 접속 로그, 기기 정보, 브라우저 정보' : 'IP address, cookies, access logs, device information, browser information'}</li>
                  <li>{isKo ? '게임 플레이 기록, 문제 해결 기록, 댓글 작성 기록' : 'Game play records, problem solving records, comment writing records'}</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '4. 개인정보의 제3자 제공' : '4. Provision of Personal Information to Third Parties'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 원칙적으로 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.'
                  : 'In principle, the Service does not provide personal information of information subjects to third parties. However, the following cases are exceptions.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '정보주체가 사전에 동의한 경우'
                    : 'When the information subject has given prior consent'}
                </li>
                <li>
                  {isKo
                    ? '법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우'
                    : 'When required by law or when there is a request from an investigative agency in accordance with procedures and methods prescribed by law for investigative purposes'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '5. 개인정보처리의 위탁' : '5. Entrustment of Personal Information Processing'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.'
                  : 'The Service entrusts personal information processing tasks as follows for smooth personal information processing.'}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-2 text-teal-300">{isKo ? '수탁업체' : 'Consignee'}</th>
                      <th className="text-left py-2 px-2 text-teal-300">{isKo ? '위탁업무 내용' : 'Entrusted Tasks'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Supabase</td>
                      <td className="py-2 px-2">{isKo ? '데이터베이스 및 인증 서비스 제공' : 'Database and authentication service provision'}</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-2 px-2">Vercel</td>
                      <td className="py-2 px-2">{isKo ? '웹 호스팅 서비스 제공' : 'Web hosting service provision'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-2">Google</td>
                      <td className="py-2 px-2">{isKo ? '로그인 인증, Google Analytics, Google AdSense' : 'Login authentication, Google Analytics, Google AdSense'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '6. 정보주체의 권리·의무 및 행사방법' : '6. Rights and Obligations of Information Subjects and How to Exercise Them'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '정보주체는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.'
                  : 'Information subjects can exercise the following rights as personal information subjects.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>{isKo ? '개인정보 열람요구' : 'Request for access to personal information'}</li>
                <li>{isKo ? '개인정보 정정·삭제요구' : 'Request for correction or deletion of personal information'}</li>
                <li>{isKo ? '개인정보 처리정지 요구' : 'Request for suspension of personal information processing'}</li>
                <li>{isKo ? '개인정보 처리동의 철회' : 'Withdrawal of consent to personal information processing'}</li>
              </ul>
              <p className="mt-4">
                {isKo
                  ? '위 권리 행사는 서비스에 대해 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며, 서비스는 이에 대해 지체 없이 조치하겠습니다.'
                  : 'The exercise of the above rights can be made to the Service in writing, e-mail, facsimile transmission (FAX), etc., and the Service will take action without delay.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '7. 쿠키 및 광고 관련 정책' : '7. Cookie and Advertising Policy'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 이용자에게 개인화된 맞춤 서비스를 제공하기 위해 쿠키를 사용합니다.'
                  : 'The Service uses cookies to provide users with personalized customized services.'}
              </p>
              <h3 className="text-xl font-semibold text-teal-300 mb-3 mt-6">
                {isKo ? '쿠키의 사용 목적' : 'Purpose of Cookie Use'}
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '로그인 상태 유지: 사용자가 로그인한 상태를 유지하여 편리한 서비스 이용을 제공합니다.'
                    : 'Maintaining login status: Maintains the user\'s logged-in state to provide convenient service use.'}
                </li>
                <li>
                  {isKo
                    ? '서비스 이용 분석: Google Analytics를 통해 서비스 이용 패턴을 분석하여 서비스 개선에 활용합니다.'
                    : 'Service usage analysis: Analyzes service usage patterns through Google Analytics to improve services.'}
                </li>
                <li>
                  {isKo
                    ? '맞춤형 광고 제공: Google AdSense를 통해 사용자에게 관련성 높은 광고를 제공합니다.'
                    : 'Personalized advertising: Provides relevant ads to users through Google AdSense.'}
                </li>
              </ul>
              <h3 className="text-xl font-semibold text-teal-300 mb-3 mt-6">
                {isKo ? '쿠키 설정 거부 방법' : 'How to Refuse Cookie Settings'}
              </h3>
              <p className="mb-4">
                {isKo
                  ? '이용자는 쿠키 설치에 대한 선택권을 가지고 있습니다. 웹 브라우저에서 옵션을 설정함으로써 쿠키에 대한 수용 여부를 결정할 수 있습니다. 다만, 쿠키 설치를 거부할 경우 서비스 이용에 어려움이 있을 수 있습니다.'
                  : 'Users have the right to choose whether to install cookies. You can decide whether to accept cookies by setting options in your web browser. However, if you refuse to install cookies, you may have difficulty using the service.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? 'Chrome: 설정 &gt; 개인정보 및 보안 &gt; 쿠키 및 기타 사이트 데이터'
                    : 'Chrome: Settings &gt; Privacy and security &gt; Cookies and other site data'}
                </li>
                <li>
                  {isKo
                    ? 'Safari: 환경설정 &gt; 개인정보 보호 &gt; 쿠키 및 웹 사이트 데이터'
                    : 'Safari: Preferences &gt; Privacy &gt; Cookies and website data'}
                </li>
                <li>
                  {isKo
                    ? 'Firefox: 옵션 &gt; 개인정보 보호 &gt; 쿠키 및 사이트 데이터'
                    : 'Firefox: Options &gt; Privacy &gt; Cookies and site data'}
                </li>
              </ul>
              <h3 className="text-xl font-semibold text-teal-300 mb-3 mt-6">
                {isKo ? 'Google AdSense 및 맞춤형 광고' : 'Google AdSense and Personalized Advertising'}
              </h3>
              <p className="mb-4">
                {isKo
                  ? '서비스는 Google AdSense를 통해 광고를 제공합니다. Google은 사용자의 관심사에 맞는 광고를 표시하기 위해 쿠키를 사용할 수 있습니다. 사용자는 Google의 광고 설정 페이지(https://www.google.com/settings/ads)에서 맞춤형 광고를 비활성화할 수 있습니다.'
                  : 'The Service provides advertisements through Google AdSense. Google may use cookies to display ads that match users\' interests. Users can disable personalized advertising on Google\'s ad settings page (https://www.google.com/settings/ads).'}
              </p>
              <p className="mb-4">
                {isKo
                  ? '또한 사용자는 Network Advertising Initiative(NAI) 옵트아웃 페이지(https://www.networkadvertising.org/choices/)에서 여러 광고 네트워크의 맞춤형 광고를 한 번에 거부할 수 있습니다.'
                  : 'Users can also opt out of personalized advertising from multiple ad networks at once on the Network Advertising Initiative (NAI) opt-out page (https://www.networkadvertising.org/choices/).'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '8. 개인정보의 파기' : '8. Destruction of Personal Information'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.'
                  : 'The Service destroys personal information without delay when it becomes unnecessary, such as when the retention period of personal information has elapsed or the processing purpose has been achieved.'}
              </p>
              <h3 className="text-xl font-semibold text-teal-300 mb-3 mt-6">
                {isKo ? '파기 방법' : 'Destruction Method'}
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '전자적 파일 형태: 복구 및 재생되지 않도록 안전하게 삭제'
                    : 'Electronic file format: Safely deleted so that it cannot be recovered or reproduced'}
                </li>
                <li>
                  {isKo
                    ? '기록물, 인쇄물, 서면 등: 분쇄하거나 소각'
                    : 'Records, printed materials, written materials, etc.: Shredded or incinerated'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '9. 개인정보 보호책임자' : '9. Personal Information Protection Officer'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.'
                  : 'The Service is responsible for overseeing all matters related to personal information processing, and has designated a personal information protection officer as follows to handle complaints and damage relief related to personal information processing.'}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <ul className="space-y-2 text-sm">
                  <li>
                    <strong className="text-teal-300">{isKo ? '이메일' : 'Email'}:</strong>{' '}
                    <a href={`mailto:${contactEmail}`} className="text-cyan-400 hover:underline">
                      {contactEmail}
                    </a>
                  </li>
                  <li>
                    <strong className="text-teal-300">{isKo ? '문의' : 'Inquiry'}:</strong>{' '}
                    <a href={`/${locale}/contact`} className="text-cyan-400 hover:underline">
                      {isKo ? '문의하기 페이지' : 'Contact Page'}
                    </a>
                  </li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '10. 개인정보 처리방침 변경' : '10. Changes to Privacy Policy'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '이 개인정보처리방침은 2025년 1월 27일부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.'
                  : 'This Privacy Policy applies from January 27, 2025, and if there are additions, deletions, or corrections to the contents due to changes in accordance with laws and policies, we will notify you through the notice 7 days before the implementation of the changes.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

