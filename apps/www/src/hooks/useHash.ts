import { useEffect, useState } from "react";

export function useHash() {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return hash;
}
