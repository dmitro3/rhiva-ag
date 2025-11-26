import { format } from "util";
import superjson from "superjson";
import type { AppRouter } from "@rhiva-ag/trpc";
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from "@trpc/client";

export const makeTRPCClient = (
  token?: string,
  url: string = process.env.NEXT_PUBLIC_API_URL!,
  tag: "Bearer" | "Session" = "Bearer",
) =>
  createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({ url, transformer: superjson }),
        false: httpBatchLink({
          url,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: "include",
            });
          },
          transformer: superjson,
          async headers() {
            const headers = new Headers();
            if (token)
              headers.set("authorization", format("%s %s", tag, token));
            return headers;
          },
        }),
      }),
    ],
  });
