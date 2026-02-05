import type { Metadata } from "next";
import Header from "../components/Header";
import LangScript from "@/components/LangScript";
import ToastContainer from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsGate } from "@/components/AnalyticsGate";
import SocialBottomBar from "@/components/SocialBottomBar";
import { getMessages, type Locale, isValidLocale, defaultLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { measurePageLoad, monitorMemoryUsage } from "@/lib/performance-monitor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";
  const baseUrl = `${siteUrl}/${locale}`;

  // Title: 브랜드 + 핵심 키워드, 50~60자
  const siteName = locale === "ko" ? "퀴즈 천국" : "Quiz Paradise";
  const title =
    locale === "ko"
      ? "퀴즈 천국 | 바다거북스프·추리 퀴즈·라이어 게임"
      : "Quiz Paradise | Turtle Soup·Logic Quiz·Liar Game";

  // Meta Description: 90~155자
  const description =
    locale === "ko"
      ? "바다거북스프, 라이어 게임, 마피아 등 추리 퀴즈를 즐기세요. 친구와 멀티플레이, 오늘의 문제, 문제 만들기. 퀴즈 천국에서 실력과 랭킹을 확인하세요."
      : "Play Turtle Soup, Liar Game, Mafia and more. Multiplayer with friends, daily puzzles, create your own. Check your rank and skills at Quiz Paradise.";

  const ogImage = `${siteUrl}/og-default.png`;

  return {
    title: title.slice(0, 60),
    description: description.slice(0, 155),
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko`,
        en: `${siteUrl}/en`,
        "x-default": `${siteUrl}/ko`,
      },
    },
    openGraph: {
      type: "website",
      siteName,
      title: title.slice(0, 60),
      description: description.slice(0, 155),
      url: baseUrl,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? "en_US" : "ko_KR",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: title.slice(0, 60),
      description: description.slice(0, 155),
      images: [ogImage],
    },
  };
}

// 성능 모니터링 클라이언트 컴포넌트
function PerformanceMonitor() {
  if (typeof window !== "undefined") {
    measurePageLoad();
    if (process.env.NODE_ENV === "development") {
      monitorMemoryUsage();
    }
  }
  return null;
}

export default async function LangLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;

  // 유효하지 않은 언어는 404
  if (!isValidLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;
  const messages = getMessages(locale);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: locale === "ko" ? "퀴즈 천국" : "Quiz Paradise",
    description:
      locale === "ko"
        ? "다양한 퀴즈와 추리 게임을 즐기는 퀴즈 플랫폼"
        : "A quiz platform where you can enjoy various quizzes and deduction games",
    url: `${siteUrl}/${locale}`,
    applicationCategory: "Game",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: locale === "ko" ? "KRW" : "USD",
    },
    game: {
      "@type": "VideoGame",
      name: locale === "ko" ? "퀴즈 천국" : "Quiz Paradise",
      description: locale === "ko" ? "추리 게임" : "Deduction Game",
      gamePlatform: "Web Browser",
      genre: locale === "ko" ? "추리게임" : "Puzzle",
    },
  };

  return (
    <ErrorBoundary>
      <LangScript />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* hreflang 태그 */}
      <link rel="alternate" hrefLang="ko" href={`${siteUrl}/ko`} />
      <link rel="alternate" hrefLang="en" href={`${siteUrl}/en`} />
      <link rel="alternate" hrefLang="x-default" href={`${siteUrl}/ko`} />

      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">{children}</main>
        <SocialBottomBar />
      </div>

      <ToastContainer />
      <AnalyticsGate />
      <PerformanceMonitor />
    </ErrorBoundary>
  );
}
