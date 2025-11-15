import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const defaultLocale = "en";
  const cookie = await cookies();
  const locale = cookie.get("locale")?.value || defaultLocale;

  return {
    locale,
    timeZone: "Africa/Lagos",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
