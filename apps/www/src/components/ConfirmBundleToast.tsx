import Link from "next/link";
import { format } from "util";
import { MdOpenInNew } from "react-icons/md";
import { useCallback, useMemo } from "react";
import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "@/trpc.client";
import BackgroundJobToast from "./BackgroundJobToast";

type ConfirmBundleToastProps = {
  bundleId: string;
  onSuccess?: (returnvalue: unknown) => Promise<void>;
  setBundleId: React.Dispatch<React.SetStateAction<string | undefined>>;
} & Omit<
  React.ComponentProps<typeof BackgroundJobToast>,
  "action" | "setJobId" | "jobId" | "status" | "onSuccess"
>;

export default function ConfirmTransactionToast({
  bundleId,
  setBundleId,
  onSuccess,
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
        if (status === "progress") return "progress";
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
      subtitle={data?.message}
      message={(status) => {
        if (status === data?.status && data.message) return data.message;
        else if (status === "error" && error) return error.message;
        return props.message(status);
      }}
      action={action}
      jobId={bundleId}
      setJobId={setBundleId}
      onSuccess={async () => {
        if (data && "returnvalue" in data) return onSuccess?.(data.returnvalue);
      }}
      status={transformStatus(data?.status)}
    />
  );
}
