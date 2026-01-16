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
  const messages = getMessages(locale);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";
  const baseUrl = `${siteUrl}/${locale}`;

  const siteName = locale === "ko" ? "바다거북스프" : "Pelican Soup Riddle";
  const siteDescription =
    locale === "ko"
      ? "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임. 친구들과 함께 실시간으로 추리 게임을 즐기세요."
      : "A deduction game where you uncover the truth through questions. Play with friends in real-time.";

  return {
    title: siteName,
    description: siteDescription,
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
      title: siteName,
      description: siteDescription,
      url: baseUrl,
      locale: locale === "ko" ? "ko_KR" : "en_US",
      alternateLocale: locale === "ko" ? "en_US" : "ko_KR",
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
    name: locale === "ko" ? "바다거북스프게임" : "Pelican Soup Riddle",
    description:
      locale === "ko"
        ? "추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 바다거북스프 게임"
        : "A deduction game where you uncover the truth through questions",
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
      name: locale === "ko" ? "바다거북스프" : "Pelican Soup Riddle",
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
