import xior from "xior";
import type z from "zod";
import { URL } from "url";
import { format } from "util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { safeAuthUserSchema } from "@rhiva-ag/trpc";

export function registerAuthRoutes(apiURL = process.env.NEXT_PUBLIC_API_URL) {
  async function POST(request: Request) {
    const { pathname } = new URL(request.url);
    const isPathname = (value: string) => pathname.includes(value);

    async function firebaseSignIn(token: string) {
      const { data } = await xior.post<z.infer<typeof safeAuthUserSchema>>(
        format("%s/auth/firebase", apiURL),
        { token },
      );
      return data;
    }

    async function walletSignIn(body: object) {
      const { data } = await xior.post<z.infer<typeof safeAuthUserSchema>>(
        format("%s/auth/wallet", apiURL),
        body,
      );
      return data;
    }

    const cookie = await cookies();

    const expiresIn = 604_800_000;
    const body = await request.json();

    let user: z.infer<typeof safeAuthUserSchema>;
    if (isPathname("firebase")) {
      const { token } = body;

      user = await firebaseSignIn(token);
    } else if (isPathname("wallet")) user = await walletSignIn(body);
    else
      return NextResponse.json(
        { message: "invalid auth endpoint" },
        { status: 404 },
      );

    cookie
      .set("session", user.token, {
        path: "/",
        secure: true,
        httpOnly: true,
        maxAge: expiresIn / 1_000,
      })
      .set("user", JSON.stringify(user), {
        path: "/",
        secure: true,
        httpOnly: true,
        maxAge: 300,
      });
    return NextResponse.json(user);
  }

  async function DELETE() {
    const cookie = await cookies();
    cookie.delete("session");

    return NextResponse.json({ status: true });
  }

  return { POST, DELETE };
}
