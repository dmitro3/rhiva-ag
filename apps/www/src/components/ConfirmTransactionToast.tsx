import { toast } from "react-toastify";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { sendTransaction } from "@/instances";

type ConfirmTransactionToastProps = {
  bundleId: string;
  setBundleId: React.Dispatch<React.SetStateAction<string | undefined>>;
};

export default function ConfirmTransactionToast({
  bundleId,
  setBundleId,
}: ConfirmTransactionToastProps) {
  const queryKey = useMemo(() => ["transactions", bundleId], [bundleId]);
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => sendTransaction.safeGetBundle(bundleId, 30),
  });

  useEffect(() => {
    if (isPending)
      toast.dark("Confirming Transaction", {
        isLoading: true,
        toastId: bundleId,
      });
    else if (data)
      toast.dark("Transaction confirmed", {
        type: "success",
        toastId: bundleId,
        onClose: () => setBundleId(undefined),
      });
    else if (error)
      toast.dark("Transaction Failed to Land.", {
        type: "error",
        toastId: bundleId,
        onClose: () => setBundleId(undefined),
      });

    return () => toast.dismiss(bundleId);
  }, [isPending, data, bundleId, error, setBundleId]);

  return null;
}
