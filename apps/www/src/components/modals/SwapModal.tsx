"use client";
import clsx from "clsx";
import Decimal from "decimal.js";
import { number, object } from "yup";
import { toast } from "react-toastify";
import { useMemo, useState } from "react";
import { logEvent } from "firebase/analytics";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { MdClose, MdSwapVert } from "react-icons/md";
import { Form, FormikContext, useFormik } from "formik";
import { useWallet } from "@solana/wallet-adapter-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import TokenInput from "../TokenInput";
import { useDex } from "@/hooks/useDex";
import { useTRPC } from "@/trpc.client";
import { sendTransaction } from "@/instances";
import type { Token } from "./SelectTokenModal";
import SelectTokenModal from "./SelectTokenModal";
import { DefaultToken } from "@/constants/tokens";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useBalances } from "@/hooks/useBalances";

type SwapModalProps = {
  modal?: boolean;
  tokens?: [Token, Token];
} & React.ComponentProps<typeof Dialog>;

export default function Swap({
  tokens,
  modal = false,
  ...props
}: SwapModalProps) {
  const form = useMemo(() => <SwapForm tokens={tokens} />, [tokens]);

  return modal ? (
    <SwapModal {...props}>{form}</SwapModal>
  ) : (
    <>
      <div className={clsx("lt-sm:hidden", props.className)}>{form}</div>
      <SwapModal
        {...props}
        className={clsx("sm:hidden", props.className)}
      >
        {form}
      </SwapModal>
    </>
  );
}

function SwapForm({
  tokens = [DefaultToken.Usdc, DefaultToken.Sol],
  ...props
}: React.ComponentProps<typeof Form> & Pick<SwapModalProps, "tokens">) {
  const dex = useDex();
  const trpc = useTRPC();
  const wallet = useWallet();
  const analytics = useAnalytics();
  const { isAuthenticated, signIn, user } = useAuth();
  const [[inputBalance, outputBalance], setBalances] = useState([0, 0]);
  const [showSelectInputTokenModal, setShowSelectInputTokenModal] =
    useState(false);
  const [showSelectOutputTokenModal, setShowSelectOutputTokenModal] =
    useState(false);

  const { mutateAsync } = useMutation(trpc.token.swap.mutationOptions({}));
  const validationSchema = useMemo(
    () =>
      object({
        inputAmount: number()
          .moreThan(0)
          .max(inputBalance, "Insufficient balance")
          .required(),
      }),
    [inputBalance],
  );

  const formikContext = useFormik({
    validationSchema,
    validateOnMount: true,
    initialValues: {
      inputToken: tokens?.[0],
      outputToken: tokens?.[1],
      inputAmount: undefined as unknown as number,
    },
    async onSubmit(values) {
      if (!isAuthenticated) await signIn();
      const swapValue = {
        amount: values.inputAmount,
        inputMint: values.inputToken.mint,
        outputMint: values.outputToken.mint,
        slippage: user.settings.slippage * 100,
        inputDecimals: values.inputToken.decimals,
        outputDecimals: values.outputToken.decimals,
      };
      let data: typeof swapValue | { transactions: string[] } = swapValue;
      if (user.wallet.external) {
        const jitoTipLamports = Number(
          await sendTransaction.recentJitoTip("50ema"),
        );
        if (wallet.publicKey) {
          const { transaction } = await dex.swap.jupiter.buildSwap({
            ...swapValue,
            owner: wallet.publicKey,
            prioritizationFeeLamports: {
              jitoTipLamports,
            },
            amount: BigInt(
              new Decimal(values.inputAmount)
                .mul(Math.pow(10, values.inputToken.decimals))
                .toFixed(0),
            ),
          });

          data = {
            transactions: [
              (await wallet.signTransaction!(transaction))
                .serialize()
                .toBase64(),
            ],
          };
        } else return;
      }
      const bundleId = await mutateAsync(data);
      if (analytics)
        logEvent(analytics, "swap_transaction", { bundleId, ...swapValue });

      toast.success("🎉 Token swapped successfully.");
    },
  });

  const { values, setFieldValue, isValid, isSubmitting, errors } =
    formikContext;
  useBalances({
    defaultValue: [values.inputToken.balance, values.outputToken.balance],
    mints: [
      { address: values.inputToken.mint, decimals: values.inputToken.decimals },
      {
        address: values.outputToken.mint,
        decimals: values.outputToken.decimals,
      },
    ],
    callback: setBalances,
  });

  const { data: quote } = useQuery({
    refetchInterval: 60_000,
    enabled: values.inputAmount > 0,
    queryKey: [
      "quote",
      values.inputToken.mint,
      values.outputToken.mint,
      values.inputAmount,
    ],
    queryFn: () =>
      dex.swap.jupiter.jupiter.quoteGet({
        inputMint: values.inputToken.mint,
        outputMint: values.outputToken.mint,
        // @ts-expect-error invalid openapi type
        amount: BigInt(
          new Decimal(values.inputAmount)
            .mul(Math.pow(10, values.inputToken.decimals))
            .toFixed(0),
        ),
      }),
  });

  const outAmount = useMemo(
    () =>
      quote
        ? new Decimal(quote.outAmount)
            .div(Math.pow(10, values.outputToken.decimals))
            .toNumber()
        : 0,
    [quote, values.outputToken.decimals],
  );

  return (
    <FormikContext value={formikContext}>
      <Form
        {...props}
        className={clsx("flex flex-col  space-y-8", props.className)}
      >
        <div className="relative flex flex-col justify-center">
          <div>
            <TokenInput
              label="Sell"
              value={values.inputAmount}
              balance={inputBalance}
              token={{
                mint: values.inputToken.mint,
                icon: values.inputToken.icon,
                symbol: values.inputToken.symbol,
                decimals: values.inputToken.decimals,
              }}
              onSwitch={() => setShowSelectInputTokenModal(true)}
              onChange={(value) => setFieldValue("inputAmount", value)}
              className={clsx(
                errors.inputAmount && "border border-red-500 bg-red-500/10",
              )}
            />
          </div>
          <button
            type="button"
            className="z-10 absolute self-center size-8 flex items-center justify-center bg-dark-secondary border border-white/10 rounded-full"
            onClick={() => {
              const inputToken = values.inputToken;
              const outputToken = values.outputToken;
              setFieldValue("outputToken", inputToken);
              setFieldValue("inputToken", outputToken);
            }}
          >
            <MdSwapVert size={16} />
          </button>
          <TokenInput
            label="Buy"
            value={outAmount}
            balance={outputBalance}
            inputAttrs={{ disabled: true }}
            token={{
              mint: values.outputToken.mint,
              icon: values.outputToken.icon,
              symbol: values.outputToken.symbol,
              decimals: values.outputToken.decimals,
            }}
            onSwitch={() => setShowSelectOutputTokenModal(true)}
            onChange={(value) => setFieldValue("outputAmount", value)}
            className="mt-4 bg-transparent border-white/20"
          />
        </div>
        <button
          type="submit"
          disabled={!isValid}
          className={clsx(
            "flex items-center justify-center rounded-md",
            isAuthenticated && isValid
              ? "bg-primary text-black"
              : "border border-white/20 bg-gray/30 text-gray",
          )}
        >
          {isSubmitting ? (
            <div className="my-2 size-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="my-2">Swap</span>
          )}
        </button>
        <SelectTokenModal
          value={values.inputToken}
          open={showSelectInputTokenModal}
          onClose={setShowSelectInputTokenModal}
          onChange={(value) => {
            if (value.mint === values.outputToken.mint) return;
            setFieldValue("inputToken", value);
          }}
        />
        <SelectTokenModal
          value={values.outputToken}
          open={showSelectOutputTokenModal}
          onClose={setShowSelectOutputTokenModal}
          onChange={(value) => {
            if (value.mint === values.inputToken.mint) return;
            setFieldValue("outputToken", value);
          }}
        />
      </Form>
    </FormikContext>
  );
}

function SwapModal({
  children,
  ...props
}: React.PropsWithChildren<React.ComponentProps<typeof Dialog>>) {
  return (
    <Dialog
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0 flex lt-sm:items-end sm:items-center sm:justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="flex flex-col space-y-4 bg-dark-secondary p-4 rounded-xl lt-sm:w-full lt-md:min-w-9/10 md:min-w-md">
          <header className="flex items-center justify-between py-4">
            <DialogTitle className="text-lg font-bold sm:text-xl">
              Swap
            </DialogTitle>
            <button
              type="button"
              onClick={() => props.onClose?.(false)}
            >
              <MdClose size={18} />
            </button>
          </header>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
