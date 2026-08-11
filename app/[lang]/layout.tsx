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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://turtle-soup-rust.vercel.app";
  const baseUrl = `${siteUrl}/ko`;

  const title = "바다거북스프 | 추리 퀴즈 문제 모음";
  const description = "바다거북스프 문제를 풀어보세요. 레전드 문제, 어려운 문제, 공포·반전 문제까지 다양한 추리 퀴즈를 즐길 수 있습니다. 멀티플레이, 오늘의 문제, 랭킹까지.";
  const ogImage = `${siteUrl}/og.png`;

  return {
    title: title.slice(0, 60),
    description: description.slice(0, 155),
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: baseUrl,
    },
    openGraph: {
      type: "website",
      siteName: "바다거북스프",
      title: title.slice(0, 60),
      description: description.slice(0, 155),
      url: baseUrl,
      locale: "ko_KR",
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
    name: "바다거북스프",
    description: "다양한 퀴즈와 추리 게임을 즐기는 퀴즈 플랫폼",
    url: `${siteUrl}/ko`,
    applicationCategory: "Game",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW",
    },
  };

  return (
    <ErrorBoundary>
      <LangScript />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="flex flex-col min-h-screen bg-transparent">
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
