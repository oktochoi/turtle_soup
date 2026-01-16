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
  const baseUrl = `${siteUrl}/${locale}/terms`;

  return {
    title: locale === 'ko' ? '이용약관' : 'Terms of Service',
    description: locale === 'ko'
      ? '바다거북스프 게임의 이용약관입니다. 서비스 이용에 대한 규정을 확인하세요.'
      : 'Terms of Service for Pelican Soup Riddle. Review the rules for using the service.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/terms`,
        en: `${siteUrl}/en/terms`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '이용약관' : 'Terms of Service',
      description: locale === 'ko'
        ? '바다거북스프 게임의 이용약관'
        : 'Terms of Service for Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function TermsPage({
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
            {isKo ? '이용약관' : 'Terms of Service'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '최종 업데이트' : 'Last updated'}: {lastUpdated}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제1조 (목적)' : 'Article 1 (Purpose)'}
              </h2>
              <p>
                {isKo
                  ? '이 약관은 바다거북스프(이하 "서비스")가 제공하는 온라인 게임 서비스(이하 "서비스")의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.'
                  : 'This agreement aims to stipulate the rights, obligations, and responsibilities between the Service and users, as well as other necessary matters, regarding the use of the online game service (hereinafter referred to as the "Service") provided by Pelican Soup Riddle (hereinafter referred to as the "Service").'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제2조 (정의)' : 'Article 2 (Definitions)'}
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>{isKo ? '"서비스"' : '"Service"'}:</strong>{' '}
                  {isKo
                    ? '바다거북스프가 제공하는 온라인 추리 게임 서비스를 의미합니다.'
                    : 'Refers to the online deduction game service provided by Pelican Soup Riddle.'}
                </li>
                <li>
                  <strong>{isKo ? '"이용자"' : '"User"'}:</strong>{' '}
                  {isKo
                    ? '이 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 의미합니다.'
                    : 'Refers to members and non-members who agree to this agreement and use the Service.'}
                </li>
                <li>
                  <strong>{isKo ? '"회원"' : '"Member"'}:</strong>{' '}
                  {isKo
                    ? '서비스에 회원등록을 하고 서비스를 이용하는 자를 의미합니다.'
                    : 'Refers to a person who has registered as a member and uses the Service.'}
                </li>
                <li>
                  <strong>{isKo ? '"콘텐츠"' : '"Content"'}:</strong>{' '}
                  {isKo
                    ? '이용자가 서비스를 이용하면서 생성한 문제, 댓글, 게시글 등을 의미합니다.'
                    : 'Refers to problems, comments, posts, etc. created by users while using the Service.'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제3조 (약관의 게시와 개정)' : 'Article 3 (Posting and Amendment of Terms)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면에 게시합니다.'
                  : 'The Service posts the contents of this agreement on the initial screen of the Service so that users can easily know them.'}
              </p>
              <p>
                {isKo
                  ? '서비스는 필요한 경우 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다. 약관이 개정되는 경우 서비스는 개정된 약관의 내용과 시행일을 명시하여 현행약관과 함께 서비스의 초기화면에 그 시행일 7일 이전부터 시행일 후 상당한 기간 동안 공지합니다.'
                  : 'The Service may amend this agreement within the scope that does not violate related laws if necessary. If the agreement is amended, the Service will specify the contents of the amended agreement and the implementation date, and notify it on the initial screen of the Service together with the current agreement from 7 days before the implementation date to a considerable period after the implementation date.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제4조 (회원가입)' : 'Article 4 (Membership Registration)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '이용자는 서비스가 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로서 회원가입을 신청합니다.'
                  : 'A user applies for membership by filling out the membership information according to the registration form prescribed by the Service and expressing their intention to agree to this agreement.'}
              </p>
              <p className="mb-4">
                {isKo
                  ? '서비스는 제1항과 같이 회원가입을 신청한 이용자 중 다음 각 호에 해당하지 않는 한 회원으로 등록합니다.'
                  : 'The Service registers as a member among users who have applied for membership as in paragraph 1, except for the following cases.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '가입신청자가 이 약관에 의하여 이전에 회원자격을 상실한 적이 있는 경우, 다만 회원자격 상실 후 3년이 경과한 자로서 서비스의 회원재가입 승낙을 얻은 경우에는 예외로 합니다.'
                    : 'If the applicant has previously lost membership status under this agreement, except for those who have obtained approval for re-registration as a member of the Service after 3 years have passed since the loss of membership status.'}
                </li>
                <li>
                  {isKo
                    ? '등록 내용에 허위, 기재누락, 오기가 있는 경우'
                    : 'If there is false information, omission, or error in the registration details'}
                </li>
                <li>
                  {isKo
                    ? '기타 회원으로 등록하는 것이 서비스의 기술상 현저히 지장이 있다고 판단되는 경우'
                    : 'If it is determined that registering as a member would significantly hinder the Service technically'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제5조 (서비스의 제공 및 변경)' : 'Article 5 (Provision and Change of Service)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 다음과 같은 서비스를 제공합니다.'
                  : 'The Service provides the following services.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>{isKo ? '온라인 추리 게임 서비스' : 'Online deduction game service'}</li>
                <li>{isKo ? '멀티플레이어 게임 방 생성 및 참여' : 'Multiplayer game room creation and participation'}</li>
                <li>{isKo ? '문제 생성 및 공유' : 'Problem creation and sharing'}</li>
                <li>{isKo ? '커뮤니티 기능 (댓글, 게시글)' : 'Community features (comments, posts)'}</li>
                <li>{isKo ? '랭킹 시스템' : 'Ranking system'}</li>
                <li>{isKo ? '기타 서비스가 추가로 제공하는 일체의 서비스' : 'All other services additionally provided by the Service'}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제6조 (서비스의 중단)' : 'Article 6 (Suspension of Service)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.'
                  : 'The Service may temporarily suspend the provision of services if there are reasons such as maintenance, replacement, and failure of information and communication equipment such as computers, or interruption of communication.'}
              </p>
              <p>
                {isKo
                  ? '서비스는 제1항의 사유로 서비스의 제공이 일시적으로 중단됨으로 인하여 이용자 또는 제3자가 입은 손해에 대하여 배상합니다. 단, 서비스가 고의 또는 과실이 없음을 입증하는 경우에는 그러하지 아니합니다.'
                  : 'The Service compensates for damages suffered by users or third parties due to the temporary suspension of service provision due to the reasons in paragraph 1. However, this does not apply if the Service proves that there was no intention or negligence.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제7조 (회원의 의무)' : 'Article 7 (Member Obligations)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '이용자는 다음 행위를 하여서는 안 됩니다.'
                  : 'Users must not engage in the following acts.'}
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  {isKo
                    ? '신청 또는 변경 시 허위내용의 등록'
                    : 'Registration of false information when applying or changing'}
                </li>
                <li>
                  {isKo
                    ? '타인의 정보 도용'
                    : 'Impersonation of others'}
                </li>
                <li>
                  {isKo
                    ? '서비스가 게시한 정보의 변경'
                    : 'Alteration of information posted by the Service'}
                </li>
                <li>
                  {isKo
                    ? '서비스가 정한 정보 이외의 정보(컴퓨터 프로그램 등) 등의 송신 또는 게시'
                    : 'Transmission or posting of information (computer programs, etc.) other than information prescribed by the Service'}
                </li>
                <li>
                  {isKo
                    ? '서비스와 기타 제3자의 저작권 등 지적재산권에 대한 침해'
                    : 'Infringement of intellectual property rights such as copyrights of the Service and other third parties'}
                </li>
                <li>
                  {isKo
                    ? '서비스와 기타 제3자의 명예를 손상시키거나 업무를 방해하는 행위'
                    : 'Acts that damage the reputation of the Service and other third parties or interfere with business'}
                </li>
                <li>
                  {isKo
                    ? '외설 또는 폭력적인 메시지, 화상, 음성, 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위'
                    : 'Acts of disclosing or posting obscene or violent messages, images, sounds, or other information contrary to public order and morals on the Service'}
                </li>
                <li>
                  {isKo
                    ? '범죄와 결부된다고 객관적으로 인정되는 행위'
                    : 'Acts that are objectively recognized as being related to crime'}
                </li>
                <li>
                  {isKo
                    ? '기타 관련 법령에 위반되는 행위'
                    : 'Other acts that violate related laws'}
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제8조 (콘텐츠의 저작권)' : 'Article 8 (Copyright of Content)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '이용자가 서비스 내에 게시한 콘텐츠의 저작권은 해당 이용자에게 있습니다. 다만, 서비스는 서비스의 운영, 전시, 전송, 배포, 홍보의 목적으로 이용자의 별도의 허락 없이 무상으로 이용할 수 있습니다.'
                  : 'The copyright of content posted by users on the Service belongs to the user. However, the Service may use it free of charge without separate permission from the user for the purpose of operating, displaying, transmitting, distributing, and promoting the Service.'}
              </p>
              <p className="mb-4">
                {isKo
                  ? '이용자는 서비스를 이용하여 취득한 정보를 서비스의 사전 승낙 없이 복제, 전송, 출판, 배포, 방송 기타 방법에 의하여 영리목적으로 이용하거나 제3자에게 이용하게 하여서는 안 됩니다.'
                  : 'Users must not reproduce, transmit, publish, distribute, broadcast, or otherwise use information obtained through the use of the Service for commercial purposes or allow third parties to use it without prior approval from the Service.'}
              </p>
              <p>
                {isKo
                  ? '이용자가 서비스에 게시한 콘텐츠가 타인의 저작권을 침해하는 경우, 서비스는 관련 법령에 따라 해당 콘텐츠를 삭제할 수 있으며, 이용자는 이에 대한 모든 법적 책임을 집니다.'
                  : 'If content posted by a user on the Service infringes on another person\'s copyright, the Service may delete the content in accordance with related laws, and the user bears all legal responsibility for this.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제9조 (면책조항)' : 'Article 9 (Disclaimer)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.'
                  : 'The Service is exempt from responsibility for service provision if the service cannot be provided due to natural disasters or equivalent force majeure.'}
              </p>
              <p className="mb-4">
                {isKo
                  ? '서비스는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.'
                  : 'The Service is not responsible for service use disruptions due to reasons attributable to the member.'}
              </p>
              <p>
                {isKo
                  ? '서비스는 회원이 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며, 그 밖의 서비스를 통하여 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.'
                  : 'The Service is not responsible for the loss of profits expected by members from using the Service, nor is it responsible for damages caused by materials obtained through the Service.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '제10조 (준거법 및 관할법원)' : 'Article 10 (Governing Law and Jurisdiction)'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '서비스와 이용자 간에 발생한 전자상거래 분쟁에 관한 소송은 제소 당시의 이용자의 주소에 의하고, 주소가 없는 경우에는 거소를 관할하는 지방법원의 전속관할로 합니다. 다만, 제소 당시 이용자의 주소 또는 거소가 명확하지 아니한 경우의 관할법원은 민사소송법상의 관할법원에 따릅니다.'
                  : 'A lawsuit regarding e-commerce disputes between the Service and users shall be filed in accordance with the user\'s address at the time of filing, and if there is no address, it shall be under the exclusive jurisdiction of the local court having jurisdiction over the residence. However, if the user\'s address or residence at the time of filing is not clear, the court of jurisdiction shall follow the court of jurisdiction under the Civil Procedure Act.'}
              </p>
              <p>
                {isKo
                  ? '서비스와 이용자 간에 제기된 전자상거래 소송에는 한국법을 적용합니다.'
                  : 'Korean law applies to e-commerce lawsuits filed between the Service and users.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

