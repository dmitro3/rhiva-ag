import Link from "next/link";
import { format } from "util";
import { MdOpenInNew } from "react-icons/md";
import { useCallback, useMemo } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "@/trpc.client";
import BackgroundJobToast from "./BackgroundJobToast";

type ConfirmBundleToastProps = {
  bundleId: string;
  setBundleId: React.Dispatch<React.SetStateAction<string | undefined>>;
} & Omit<
  React.ComponentProps<typeof BackgroundJobToast>,
  "action" | "setJobId" | "jobId" | "status"
>;

export default function ConfirmTransactionToast({
  bundleId,
  setBundleId,
  ...props
}: ConfirmBundleToastProps) {
  const trpc = useTRPC();
  const { data, error } = useSubscription(
    trpc.position.transaction.subscriptionOptions({
      jobId: bundleId,
    }),
  );

  const transformStatus = useCallback(
    (status?: NonNullable<typeof data>["status"]) => {
      if (status) {
        if (status === "error") return "error";
        if (status === "completed") return "success";
      }

      return "pending";
    },
    [],
  );

  const action = useMemo(
    () => (
      <Link
        href={format("https://explorer.jito.wtf/bundle/%s", bundleId)}
        target="_blank"
      >
        <MdOpenInNew
          size={18}
          className="fill-white"
        />
      </Link>
    ),
    [bundleId],
  );

  return (
    <BackgroundJobToast
      {...props}
      message={{
        ...props.message,
        error: error ? error.message : props.message.error,
      }}
      action={action}
      jobId={bundleId}
      setJobId={setBundleId}
      status={transformStatus(data?.status)}
    />
  );
}
