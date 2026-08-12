// SEO 메타데이터 헬퍼 함수 — 한국어 단일 언어

import { getSiteUrl } from '@/lib/site-config';

const baseUrl = getSiteUrl();
const twitterHandle = '@turtlesoup';

export type Locale = 'ko';

type RobotsInfo = {
  index?: boolean;
  follow?: boolean;
  'max-video-preview'?: number;
  'max-image-preview'?: 'large' | 'none' | 'standard';
  'max-snippet'?: number;
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
  keywords?: string[];
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
  keywords = [],
}: MetadataProps) {
  const siteName = '바다거북스프';
  const siteDescription = '바다거북스프 문제를 풀어보세요. 레전드 문제, 어려운 문제, 공포·반전 문제까지 다양한 추리 퀴즈를 즐길 수 있습니다.';
  const rawTitle = title ? `${title} - ${siteName}` : siteName;
  const fullTitle = sanitizeTitle(rawTitle).slice(0, 60);
  const fullDescription = truncateDescription(description || siteDescription, 155);
  const canonicalUrl = `${baseUrl}${path}`;
  const ogImage = image || `${baseUrl}/og.png`;
  const keywordList = keywords.filter(Boolean);

  return {
    title: fullTitle,
    description: fullDescription,
    keywords: keywordList.length ? keywordList : undefined,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalUrl,
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
      locale: 'ko_KR',
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
