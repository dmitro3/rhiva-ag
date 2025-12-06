import { format } from "util";
import { mapFilter } from "./collection";

export function buildPathWithQueryString(
  path: string,
  query?: Record<string, string | boolean | number | string[] | undefined>,
) {
  let encodedQuery: Record<string, string> | undefined;

  if (query)
    encodedQuery = Object.fromEntries(
      mapFilter(Object.entries(query), ([key, value]) => {
        if (Array.isArray(value)) return [key, value.join(",")];
        else if (value) return [key, value.toString()];
        return null;
      }),
    );
  const q = new URLSearchParams(encodedQuery);
  return format("%s?%s", path, q.toString());
}
