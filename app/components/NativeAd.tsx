"use client";

import Script from "next/script";
import { useEffect } from "react";

export default function NativeAd() {
  // Next.js 라우팅으로 다시 들어올 때 중복 마운트 방지
  useEffect(() => {
    // 필요 시 여기서 추가 로직 가능
  }, []);

  return (
    <div className="my-4">
      <Script
        src="https://pl28489713.effectivegatecpm.com/e55815afb3e5d73fa76db3038a7eff13/invoke.js"
        strategy="afterInteractive"
        data-cfasync="false"
      />
      <div id="container-e55815afb3e5d73fa76db3038a7eff13" />
    </div>
  );
}
