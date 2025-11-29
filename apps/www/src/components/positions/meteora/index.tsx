import clsx from "clsx";
import type z from "zod";
import { format } from "util";
import { object, number } from "yup";
import { useDex } from "@/hooks/useDex";
import { PublicKey } from "@solana/web3.js";
import { sendTransaction } from "@/instances";
import type { Pair } from "@rhiva-ag/dex-api";
import { IoArrowBack } from "react-icons/io5";
import { logEvent } from "firebase/analytics";
import { NATIVE_MINT } from "@solana/spl-token";
import { POSITION_FEE } from "@meteora-ag/dlmm";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useCallback, useMemo, useState } from "react";
import { fromWebWalletAdapter } from "@rhiva-ag/shared";
import { Form, FormikContext, useFormik } from "formik";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  createMeteoraPosition,
  meteoraCreatePositionSchema,
} from "@rhiva-ag/trpc/browser";

import TokenInput from "./TokenInput";
import RatioInput from "./RatioInput";
import Image from "@/components/Image";
import { useTRPC } from "@/trpc.client";
import PriceRangeInput from "./PriceRangeInput";
import { useAnalytics } from "@/hooks/useAnalytics";
import { getActiveBin } from "@/lib/web3/meteora-patch";
import ConfirmBundleToast from "@/components/ConfirmBundleToast";

type MeteoraOpenPositionProps = {
  pool: Pair;
} & React.ComponentProps<typeof Dialog>;

export default function MeteoraOpenPosition({
  pool,
  ...props
}: MeteoraOpenPositionProps) {
  const form = useMemo(() => <MeteoraOpenPositionForm pool={pool} />, [pool]);

  return (
    <>
      <div className={clsx("lt-sm:hidden", props.className)}>{form}</div>
      <MeteoraOpenPositionSmall
        {...props}
        className={clsx("sm:hidden", props.className)}
      >
        {form}
      </MeteoraOpenPositionSmall>
    </>
  );
}

function MeteoraOpenPositionForm({
  pool,
  ...props
}: React.ComponentProps<typeof Form> & Pick<MeteoraOpenPositionProps, "pool">) {
  const dex = useDex();
  const trpc = useTRPC();
  const wallet = useWallet();
  const analytics = useAnalytics();
  const { connection } = useConnection();
  const nativeMint = NATIVE_MINT.toBase58();
  const { user, isAuthenticated, signIn } = useAuth();
  const [bundleId, setBundleId] = useState<string | undefined>();

  const { data: rawBalance } = useQuery({
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    enabled: isAuthenticated,
    queryKey: ["balance", nativeMint, user?.wallet?.id],
    queryFn: () => connection.getBalance(new PublicKey(user?.wallet?.id)),
  });

  const { data: activeBin } = useQuery({
    refetchInterval: 60_000,
    queryKey: [pool.address, "activeBin"],
    queryFn: () =>
      getActiveBin(
        connection,
        new PublicKey(pool.address),
        pool.baseToken.decimals,
        pool.quoteToken.decimals,
      ),
  });

  const pairs = useMemo(() => [pool.baseToken, pool.quoteToken], [pool]);
  const curves = useMemo(
    () => [
      { label: "Spot", value: "Spot" },
      { label: "Curve", value: "Curve" },
      { label: "Bid-Ask", value: "BidAsk" },
    ],
    [],
  );
  const balance = useMemo(
    () => (rawBalance ? rawBalance / Math.pow(10, 9) : 0),
    [rawBalance],
  );

  const { mutateAsync } = useMutation(
    trpc.position.meteora.create.mutationOptions({}),
  );

  const optimalPriceChange: [number, number] = useMemo(() => {
    const maximumBinPerPosition = 69;
    const binStepPct = pool.binStep / 10_000;
    const totalRangePct = (maximumBinPerPosition * binStepPct) / 2;
    return [-totalRangePct, totalRangePct];
  }, [pool]);

  const formikContext = useFormik({
    validateOnMount: true,
    validationSchema: object({
      inputAmount: number()
        .label("amount")
        .min(0, "Invalid amount")
        .max(balance, "Insufficent funds")
        .test(
          "fee",
          format("You need %d SOL more to create position", POSITION_FEE),
          (value) => {
            if (value) {
              const remainingBalance = balance - value;
              if (remainingBalance > POSITION_FEE) return true;
              if (value > POSITION_FEE) return true;
              return false;
            }
          },
        )
        .required(),
    }),
    initialValues: {
      inputAmount: undefined as unknown as number,
      inputMint: NATIVE_MINT.toBase58(),
      strategyType: "Spot" as const,
      priceChanges: optimalPriceChange,
      liquidityRatio: [0.5, 0.5] as [number, number],
      sides: [pool.baseToken.id, pool.quoteToken.id],
      tokens: [
        {
          id: pool.baseToken.id,
          name: pool.baseToken.name,
          image: pool.baseToken.icon,
          symbol: pool.baseToken.symbol,
          decimals: pool.baseToken.decimals,
          tokenProgram: pool.baseToken.tokenProgram,
        },
        {
          id: pool.quoteToken.id,
          name: pool.quoteToken.name,
          image: pool.quoteToken.icon,
          symbol: pool.quoteToken.symbol,
          decimals: pool.quoteToken.decimals,
          tokenProgram: pool.quoteToken.tokenProgram,
        },
      ],
    },
    onSubmit: async (values) => {
      if (!isAuthenticated) await signIn();

      const createPositionValue = {
        ...values,
        pair: pool.address,
        slippage: user.settings.slippage * 100,
      };

      let data:
        | typeof createPositionValue
        | { transactions: string[]; positionMint: string } =
        createPositionValue;

      if (user.wallet.external) {
        if (wallet.publicKey) {
          const { transactions, positionMint } = await createMeteoraPosition(
            dex,
            sendTransaction,
            fromWebWalletAdapter(wallet),
            (await meteoraCreatePositionSchema.parseAsync(
              createPositionValue,
            )) as Exclude<
              z.infer<typeof meteoraCreatePositionSchema>,
              { transactions: string[] }
            >,
          );

          data = {
            positionMint: positionMint.toBase58(),
            transactions: transactions.map((transaction) =>
              transaction.serialize().toBase64(),
            ),
          };
        }
      }
      const bundleId = await mutateAsync(data).then(({ bundleId }) => bundleId);

      if (analytics)
        logEvent(analytics, "position_opened", {
          bundleId,
          dex: "meteora",
          ...createPositionValue,
        });
      setBundleId(bundleId);
    },
  });

  const { values, isValid, setFieldValue, errors, isSubmitting } =
    formikContext;
  const onLiquidityRatio = useCallback(
    (value: [number, number]) => setFieldValue("liquidityRatio", value),
    [setFieldValue],
  );
  const onPriceChanges = useCallback(
    (value: [number, number]) => setFieldValue("priceChanges", value),
    [setFieldValue],
  );

  return (
    <FormikContext value={formikContext}>
      <Form
        {...props}
        className={clsx(
          "flex-1 flex flex-col p-4 overflow-y-scroll",
          props.className,
        )}
      >
        <div className="flex sticky top-0">
          {curves.map((curve) => {
            const selected = curve.value === values.strategyType;

            return (
              <button
                key={curve.value}
                type="button"
                className="flex-1 flex items-center justify-center"
                onClick={() => setFieldValue("strategyType", curve.value)}
              >
                <div
                  className={clsx(
                    selected
                      ? "border-b-2 border-primary p-2"
                      : "text-white/50",
                  )}
                >
                  {curve.label}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex-1 flex flex-col space-y-4 py-4 overflow-y-scroll sm:py-8">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col">
              <TokenInput
                name="inputAmount"
                label="Trade amount"
                balance={balance}
                value={values.inputAmount}
                inputContainerAttrs={{
                  className: clsx(errors.inputAmount && "!border-red"),
                }}
                onChange={(value) => setFieldValue("inputAmount", value)}
              />
              <small className="text-red-500 first-letter:capitalize">
                {errors.inputAmount}
              </small>
            </div>
            <div className="flex space-x-4">
              {pairs.map((token) => {
                const selected = values.sides.find((side) => side === token.id);

                return (
                  <button
                    key={token.id}
                    type="button"
                    className={clsx(
                      "flex-1 flex items-center justify-center  border-1 p-2 rounded lt-sm:items-center lt-sm:space-x-2 sm:flex-col sm:space-y-4",
                      selected
                        ? "border-transparent bg-primary text-black"
                        : "border-gray text-gray",
                    )}
                    onClick={() => {
                      let sides = values.sides;
                      if (selected) {
                        sides = sides.filter((side) => side !== token.id);
                        if (sides.length < 1) return;
                      } else sides.push(token.id);
                      setFieldValue("sides", sides);
                    }}
                  >
                    <Image
                      src={token.icon}
                      width={24}
                      height={24}
                      alt={token.symbol}
                      className="rounded-full"
                    />
                    <span>{token.symbol}</span>
                  </button>
                );
              })}
            </div>
            {values.sides.length > 1 && (
              <RatioInput
                tokens={[pool.baseToken, pool.quoteToken]}
                value={values.liquidityRatio}
                onChange={onLiquidityRatio}
              />
            )}
            {activeBin && (
              <PriceRangeInput
                pool={pool}
                sides={[
                  Boolean(
                    values.sides.find((side) => side === pool.baseToken.id),
                  ),
                  Boolean(
                    values.sides.find((side) => side === pool.quoteToken.id),
                  ),
                ]}
                curveType={values.strategyType}
                amount={values.inputAmount}
                activeBin={activeBin}
                value={values.priceChanges}
                onChange={onPriceChanges}
                liquidityRatio={
                  values.sides.length > 1 ? values.liquidityRatio : undefined
                }
              />
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={!isValid}
          className={clsx(
            "flex items-center justify-center rounded-md",
            isValid && isAuthenticated
              ? "bg-primary text-black"
              : "bg-gray/30 border border-white/10 text-gray",
          )}
        >
          {isSubmitting ? (
            <div className="my-2 size-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="my-2">Open Position</span>
          )}
        </button>
        {bundleId && (
          <ConfirmBundleToast
            bundleId={bundleId}
            setBundleId={setBundleId}
            title="⚡Bundle Sent"
            message={{
              success: "🎉 Position Created",
              error: "Oops! Can't confirm this bundle.",
              pending: "Confirming Transaction Bundle...",
            }}
          />
        )}
      </Form>
    </FormikContext>
  );
}

function MeteoraOpenPositionSmall({
  children,
  ...props
}: React.PropsWithChildren<React.ComponentProps<typeof Dialog>>) {
  return (
    <Dialog
      as="div"
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="h-full flex flex-col bg-dark overflow-y-scroll">
          <header className="p-4 lt-sm:border-b lt-sm:border-transparent lt-sm:[border-image:linear-gradient(to_right,#000,theme(colors.primary),#000)_1]">
            <button
              type="button"
              className="flex items-center space-x-2"
              onClick={() => props?.onClose(false)}
            >
              <IoArrowBack />
              <span>Back</span>
            </button>
          </header>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
