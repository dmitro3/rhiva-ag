import z from "zod";
import { extendedUserSelectSchema } from "../../routers/users/user.schema";

export const walletAuthSchema = z.object({
  message: z.object({
    domain: z.url(),
    publicKey: z.string(),
    statement: z.string(),
    nonce: z.string().optional(), // todo csrf validation
  }),
  signature: z.string(),
});

export const firebaseTokenAuthSchema = z.object({
  token: z.string(),
});

export const safeAuthUserSchema = extendedUserSelectSchema.extend({
  token: z.string(),
});
