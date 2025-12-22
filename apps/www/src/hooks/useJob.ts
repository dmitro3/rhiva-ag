import type z from "zod";
import type { transactionEventSchema } from "@rhiva-ag/cron";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTRPCClient } from "@/trpc.client";

export const useJob = (jobId: string) => {
  const trpcClient = useTRPCClient();

  const pending = useRef<boolean>(true);
  const interval = useRef<number | null>(null);

  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<z.Infer<
    typeof transactionEventSchema
  > | null>(null);

  const isPending = useMemo(() => {
    return !result || ["pending", "progress", "queued"].includes(result.status);
  }, [result]);

  useEffect(() => {
    pending.current = isPending;
  }, [isPending]);

  const manualFetchJobData = useCallback(async () => {
    return trpcClient.job.retrieve
      .query({ jobId })
      .then((result) => {
        setResult(result);
        return result;
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
  }, [trpcClient, jobId]);

  useEffect(() => {
    const subscription = trpcClient.job.subscribe.subscribe(
      { jobId },
      {
        onData: setResult,
        async onStopped() {
          if (pending.current) {
            const job = await manualFetchJobData();
            if (job) return;
          }
          setError(new Error("Job subscription stopped unexpectedly."));
        },
        async onError(err) {
          if (pending.current) {
            const job = await manualFetchJobData();
            if (job) return;
          }
          setError(err);
        },
      },
    );

    interval.current = window.setInterval(() => {
      if (pending.current) manualFetchJobData();
    }, 15_000);

    return () => {
      subscription.unsubscribe();
      if (interval.current !== null) window.clearInterval(interval.current);
    };
  }, [trpcClient, jobId, manualFetchJobData]);

  return { data: result, isPending, error };
};
