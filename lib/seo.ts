// SEO 메타데이터 헬퍼 함수

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
const twitterHandle = '@turtlesoup'; // 실제 트위터 계정이 있으면 변경

export type Locale = 'ko' | 'en';

type RobotsInfo = {
  index?: boolean;
  follow?: boolean;
  'max-video-preview'?: number;
  'max-image-preview'?: 'large' | 'none' | 'standard';
  'max-snippet'?: number;
};

const getSiteName = (locale: Locale = 'ko') => {
  return locale === 'ko' ? '바다거북스프' : 'Turtle Soup';
};

const getSiteDescription = (locale: Locale = 'ko') => {
  return locale === 'ko' 
    ? '추리와 질문으로 진실을 밝혀내는 게임. 멀티플레이어 모드와 오늘의 문제로 친구들과 함께 즐기세요.'
    : 'A deduction game where you uncover the truth through questions. Play with friends in multiplayer mode and daily problems.';
};

export type MetadataProps = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  noindex?: boolean;
  locale?: Locale;
};

export function generateMetadata({
  title,
  description,
  path = '',
  image,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  noindex = false,
  locale = 'ko',
}: MetadataProps) {
  const siteName = getSiteName(locale);
  const siteDescription = getSiteDescription(locale);
  const fullTitle = title ? `${title} - ${siteName}` : siteName;
  const fullDescription = description || siteDescription;
  const canonicalUrl = `${baseUrl}${path}`;
  const ogImage = image || `${baseUrl}/og-default.png`;

  return {
    title: fullTitle,
    description: fullDescription,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'ko': `${baseUrl}/ko${path.replace(/^\/[^/]+/, '')}`,
        'en': `${baseUrl}/en${path.replace(/^\/[^/]+/, '')}`,
        'x-default': `${baseUrl}/ko${path.replace(/^\/[^/]+/, '')}`,
      },
    },
    robots: {
      index: !noindex,
      follow: !noindex,
      googleBot: {
        index: !noindex,
        follow: !noindex,
        'max-video-preview': -1,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      } as RobotsInfo,
    },
    openGraph: {
      type,
      siteName,
      title: fullTitle,
      description: fullDescription,
      url: canonicalUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      alternateLocale: locale === 'ko' ? 'en_US' : 'ko_KR',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      images: [ogImage],
      creator: twitterHandle,
    },
  };
}

export function truncateDescription(text: string, maxLength: number = 160): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(/[<>]/g, '')
    .substring(0, 60)
    .trim();
}

