import { format } from "util";
import superjson from "superjson";
import type { AppRouter } from "@rhiva-ag/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const makeTRPCClient = (
  token?: string,
  tag: "Bearer" | "Session" = "Bearer",
) =>
  createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          });
        },
        url: process.env.NEXT_PUBLIC_API_URL!,
        transformer: superjson,
        async headers() {
          const headers = new Headers();
          if (token) headers.set("authorization", format("%s %s", tag, token));
          return headers;
        },
      }),
    ],
  });
