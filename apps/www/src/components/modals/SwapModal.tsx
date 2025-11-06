"use client";
import clsx from "clsx";
import { toast } from "react-toastify";
import { useMemo, useState } from "react";
import { logEvent } from "firebase/analytics";
import { useMutation } from "@tanstack/react-query";
import { MdClose, MdSwapVert } from "react-icons/md";
import { Form, FormikContext, useFormik } from "formik";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import TokenInput from "../TokenInput";
import { useTRPC } from "@/trpc.client";
import { useAuth } from "@/hooks/useAuth";
import type { Token } from "./SelectTokenModal";
import SelectTokenModal from "./SelectTokenModal";
import { DefaultToken } from "@/constants/tokens";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useDex } from "@/hooks/useDex";
import { useWallet } from "@solana/wallet-adapter-react";

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
      <div className="lt-md:hidden">{form}</div>
      <SwapModal
        {...props}
        className="md:hidden"
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
  const [showSelectInputTokenModal, setShowSelectInputTokenModal] =
    useState(false);
  const [showSelectOutputTokenModal, setShowSelectOutputTokenModal] =
    useState(false);

  const { mutateAsync } = useMutation(trpc.token.swap.mutationOptions({}));

  const formikContext = useFormik({
    initialValues: {
      inputToken: tokens?.[0],
      outputToken: tokens?.[1],
      inputAmount: undefined as unknown as number,
      outputAmount: undefined as unknown as number,
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
        if (wallet.publicKey) {
          const { transaction } = await dex.swap.jupiter.buildSwap({
            ...swapValue,
            owner: wallet.publicKey,
            amount:
              BigInt(values.inputAmount) *
              BigInt(Math.pow(10, values.inputToken.decimals)),
          });

          data = { transactions: [transaction.serialize().toBase64()] };
        } else return;
      }
      const bundleId = await mutateAsync(data);
      if (analytics)
        logEvent(analytics, "swap_transaction", { bundleId, ...swapValue });

      toast.success("🎉 Token swapped successfully.");
    },
  });

  const { values, setFieldValue, isValid, isSubmitting } = formikContext;

  return (
    <FormikContext value={formikContext}>
      <Form
        {...props}
        className={clsx("flex flex-col  space-y-8", props.className)}
      >
        <div className="relative flex flex-col justify-center">
          <TokenInput
            label="Sell"
            value={values.inputAmount}
            icon={values.inputToken.icon}
            symbol={values.inputToken.symbol}
            balance={values.inputToken.balance}
            onSwitch={() => setShowSelectInputTokenModal(true)}
            onChange={(value) => setFieldValue("inputAmount", value)}
          />
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
            value={values.outputAmount}
            icon={values.outputToken.icon}
            symbol={values.outputToken.symbol}
            balance={values.outputToken.balance}
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
          onChange={(value) => setFieldValue("inputToken", value)}
        />
        <SelectTokenModal
          value={values.outputToken}
          open={showSelectOutputTokenModal}
          onClose={setShowSelectOutputTokenModal}
          onChange={(value) => setFieldValue("outputToken", value)}
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
        <DialogPanel className="flex flex-col space-y-4 bg-dark-secondary p-4 rounded-xl lt-md:min-w-9/10 md:min-w-md">
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
