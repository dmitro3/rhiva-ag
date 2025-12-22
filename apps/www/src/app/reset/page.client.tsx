"use client";
import { format } from "util";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useMounted } from "@/hooks/useMounted";

export default function ResetPageClient() {
  const router = useRouter();
  const mounted = useMounted();

  useEffect(() => {
    if (mounted) {
      document.cookie.split(";").forEach((cookie) => {
        // biome-ignore lint/suspicious/noDocumentCookie: todo using cookieStore with polyfill
        document.cookie = cookie
          .replace(/^ +/, "")
          .replace(
            /=.*/,
            format("=;expires=%s;path=/", new Date().toUTCString()),
          );
      });
      window.localStorage.clear();
      return router.replace("/");
    }
  }, [mounted, router]);

  return null;
}
