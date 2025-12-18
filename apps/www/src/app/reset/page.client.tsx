"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMounted } from "@/hooks/useMounted";

export default function ResetPageClient() {
  const router = useRouter();
  const mounted = useMounted();

  useEffect(() => {
    if (mounted) {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      window.localStorage.clear();
      return router.replace("/");
    }
  }, [mounted, router]);

  return null;
}
