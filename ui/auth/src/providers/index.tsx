import "server-only";
import type z from "zod";
import { cookies } from "next/headers";
import type { FirebaseOptions } from "firebase/app";
import type { safeAuthUserSchema } from "@rhiva-ag/trpc";

import { makeTRPCClient } from "../trpc";
import AuthProvider from "./AuthProvider";

type AuthProps = {
  logo: React.ReactNode;
  firebaseOptions?: FirebaseOptions;
};

export async function Auth({
  logo,
  children,
  firebaseOptions,
}: React.PropsWithChildren<AuthProps>) {
  const cookie = await cookies();
  const session = cookie.get("session");
  let user: z.infer<typeof safeAuthUserSchema> | undefined;

  if (session) {
    const trpcClient = makeTRPCClient(session.value);
    const response = await trpcClient.user.me.query();

    user = { token: session.value, ...response };
  }

  return (
    <AuthProvider
      logo={logo}
      serverUser={user}
      firebaseOptions={firebaseOptions}
    >
      {children}
    </AuthProvider>
  );
}
