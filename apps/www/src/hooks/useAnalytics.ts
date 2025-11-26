import { type Analytics, getAnalytics, isSupported } from "firebase/analytics";
import { useEffect, useState } from "react";

export const useAnalytics = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    isSupported().then((isSupported) => {
      if (isSupported) setAnalytics(getAnalytics());
    });
  }, []);

  return analytics;
};
