"use client";
import { useMounted } from "@/hooks/useMounted";

export default function ClientOnly({ children }: React.PropsWithChildren) {
  const mounted = useMounted();

  return mounted && children;
}
