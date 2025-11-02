import clsx from "clsx";
import { toast } from "react-toastify";
import { MdClose } from "react-icons/md";
import { number, object, string } from "yup";
import { Field, Form, Formik } from "formik";
import { logEvent } from "firebase/analytics";
import { useEffect, useMemo, useState } from "react";
import type { Token } from "@rhiva-ag/dex-api/jup/types";
import { useConnection } from "@solana/wallet-adapter-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import { dexApi } from "@/instances";
import { useTRPC } from "@/trpc.client";
import { useAuth } from "@/hooks/useAuth";
import { getWalletPNL } from "@/lib/get-tokens";
import TokenInput from "../send-token/TokenInput";
import TokenSelect from "../send-token/TokenSelect";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function SendTokenModal(
  props: React.ComponentProps<typeof Dialog>,
) {
  return (
    <Dialog
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0 flex lt-sm:items-end sm:items-center sm:justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="flex flex-col space-y-4 bg-dark p-4 rounded-2xl lt-sm:w-full md:min-w-md">
          <header className="flex items-center justify-between py-4">
            <DialogTitle className="text-lg  font-semibold sm:text-xl">
              Send
            </DialogTitle>
            <button
              type="button"
              onClick={() => props.onClose?.(false)}
            >
              <MdClose size={18} />
            </button>
          </header>
          <SendTokenForm />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function SendTokenForm(props: React.ComponentProps<typeof Form>) {
  const trpc = useTRPC();
  const analytics = useAnalytics();
  const { connection } = useConnection();
  const { isAuthenticated, user } = useAuth();
  const [token, setToken] = useState<Token & { balance: number }>();

  const { data } = useQuery({
    queryKey: ["wallet", "tokens", user.wallet.id],
    queryFn: async () => getWalletPNL(connection, dexApi, user.wallet.id),
  });

  const { mutateAsync } = useMutation(trpc.token.send.mutationOptions({}));

  const tokens = useMemo(
    () => data?.tokens.filter((token) => token.balance > 0),
    [data],
  );

  useEffect(() => {
    if (tokens) setToken((token) => (token ? token : tokens[0]));
  }, [tokens]);

  return (
    tokens &&
    token && (
      <Formik
        validationSchema={object({
          recipient: string().required(),
          inputAmount: number()
            .label("amount")
            .min(0, "Invalid amount")
            .max(token.balance)
            .required(),
        })}
        initialValues={{
          amount: "",
          recipient: "",
        }}
        onSubmit={async (values) => {
          if (token) {
            const sendValues = {
              inputMint: token.id,
              recipient: values.recipient,
              inputDecimals: token.decimals,
              inputTokenProgram: token.tokenProgram,
              inputAmount:
                BigInt(values.amount) * BigInt(Math.pow(10, token.decimals)),
            };
            const signature = await mutateAsync(sendValues);
            if (analytics)
              logEvent(analytics, "send_token_transaction", {
                signature,
                ...sendValues,
              });
            toast.success("🎉 Token sent successfully.");
          }
        }}
      >
        {({ values, setFieldValue, errors, isValid, isSubmitting }) => (
          <Form
            {...props}
            className={clsx("flex flex-col space-y-8", props.className)}
          >
            <div className="relative flex flex-col justify-center space-y-4">
              <TokenInput
                value={values.amount}
                amount={token.balance}
                priceUsd={token.usdPrice}
                symbol={token.symbol}
                onChange={(value) => setFieldValue("amount", value)}
              />
              <div className="flex flex-col space-y-2">
                <label
                  htmlFor="token"
                  className="text-gray"
                >
                  Token
                </label>
                <TokenSelect
                  value={token}
                  tokens={tokens}
                  onChange={(value) => setToken(value)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label htmlFor="recipient">Recipient</label>
                <div className="flex flex-col">
                  <Field
                    name="recipient"
                    placeholder="Paste address"
                    className={clsx(
                      "bg-black/10 border p-3 placeholder-text-gray rounded lt-sm:text-center",
                      errors.recipient ? "border-red-500" : "border-white/5",
                    )}
                  />
                  <span className="text-xs text-red-500">
                    {errors.recipient}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <div className="text-xs text-center">
                <span className="text-lime-300">Caution: </span>
                <span className="text-gray">
                  Please confirm address before you click "send"
                </span>
              </div>
              <button
                type="submit"
                disabled={!isValid}
                className={clsx(
                  "flex items-center justify-center rounded-md",
                  isAuthenticated && isValid
                    ? "bg-primary text-black"
                    : "bg-gray/30 text-gray border border-white/10",
                )}
              >
                {isSubmitting ? (
                  <div className="my-2 size-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="my-2">Send</span>
                )}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    )
  );
}
