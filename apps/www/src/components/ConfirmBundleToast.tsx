import Link from "next/link";
import { format } from "util";
import { MdOpenInNew } from "react-icons/md";
import { useCallback, useMemo } from "react";

import { useJob } from "@/hooks/useJob";
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
  const { data, error } = useJob(bundleId);

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
