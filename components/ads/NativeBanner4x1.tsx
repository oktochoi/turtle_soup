"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface NativeBanner4x1Props {
  /**
   * 광고를 표시할 경로 목록
   * 기본값: ['/problem/'] - problem/[id] 페이지에서만 표시
   */
  enabledRoutes?: string[];
  /**
   * 광고 컨테이너의 최소 높이 (로딩 중 레이아웃 시프트 방지)
   * 기본값: 200px
   */
  minHeight?: number;
}

// 전역 스크립트 로드 상태 추적 (중복 로드 방지)
const scriptLoadState = {
  loaded: false,
  loading: false,
};

// 스크립트 URL과 컨테이너 ID
const SCRIPT_URL = "https://pl28489651.effectivegatecpm.com/03/8a/81/038a81177705a94b1b3a016e57699e3f.js";
const CONTAINER_ID = "container-038a81177705a94b1b3a016e57699e3f";

export default function NativeBanner4x1({
  enabledRoutes = ["/problem/"],
  minHeight = 200,
}: NativeBanner4x1Props = {}) {
  const pathname = usePathname();
  const [shouldRender, setShouldRender] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 클라이언트 사이드 마운트 확인
  useEffect(() => {
    setMounted(true);
  }, []);

  // 경로 기반 광고 표시 여부 결정
  useEffect(() => {
    if (!mounted) return;
    const isEnabled = enabledRoutes.some((route) => pathname?.includes(route));
    setShouldRender(isEnabled);
  }, [pathname, enabledRoutes, mounted]);

  // 스크립트 중복 로드 방지 체크
  useEffect(() => {
    if (!shouldRender || !mounted || typeof window === "undefined") return;

    // 이미 스크립트가 DOM에 있는지 확인
    const existingScript = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existingScript) {
      scriptLoadState.loaded = true;
      scriptLoadState.loading = false;
    }
  }, [shouldRender, mounted]);

  // 스크립트 로드 완료 핸들러
  const handleScriptLoad = () => {
    scriptLoadState.loaded = true;
    scriptLoadState.loading = false;
  };

  // 스크립트 로드 에러 핸들러
  const handleScriptError = () => {
    scriptLoadState.loading = false;
    console.warn("NativeBanner4x1: 광고 스크립트 로드 실패");
  };

  // 광고를 표시하지 않을 경로면 null 반환
  if (!shouldRender || !mounted) {
    return null;
  }

  // 스크립트가 이미 로드되었거나 로딩 중이면 스크립트 태그를 렌더링하지 않음
  const shouldLoadScript = !scriptLoadState.loaded && !scriptLoadState.loading;

  return (
    <div className="w-full my-6 sm:my-8 px-4 sm:px-6">
      {/* 구분선 및 제목 (콘텐츠 추천 느낌) */}
      <div className="mb-4 pb-2 border-b border-slate-700/50">
        <p className="text-xs text-slate-500 text-center">
          <i className="ri-advertisement-line mr-1"></i>
          {typeof window !== "undefined" && navigator.language.startsWith("ko")
            ? "추천 콘텐츠"
            : "Sponsored"}
        </p>
      </div>

      {/* 광고 컨테이너 */}
      <div
        id={CONTAINER_ID}
        className="w-full max-w-4xl mx-auto overflow-hidden"
        style={{ minHeight: `${minHeight}px` }}
      />

      {/* 스크립트 로드 (중복 방지) */}
      {shouldLoadScript && (
        <Script
          src={SCRIPT_URL}
          strategy="afterInteractive"
          data-cfasync="false"
          async
          onLoad={handleScriptLoad}
          onError={handleScriptError}
        />
      )}
    </div>
  );
}

