import { cookies } from "next/headers";
import ResetPageClient from "./page.client";

export default async function Reset() {
  const cookie = await cookies();
  const items = cookie.getAll();
  await Promise.all(items.map((item) => cookie.delete(item.name)));
  return <ResetPageClient />;
}
