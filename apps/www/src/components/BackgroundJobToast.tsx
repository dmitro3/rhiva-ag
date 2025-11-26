import clsx from "clsx";
import { toast } from "react-toastify";
import { MdCheckCircle, MdError } from "react-icons/md";
import { memo, useEffect, useMemo, useRef } from "react";

type JobMessageProps = {
  title: string;
  subtitle?: string;
  type: "success" | "error" | "pending";
  action?: React.ReactNode;
  isPaused?: boolean;
};

export const JobMessage = memo(function JobMessage({
  title,
  subtitle,
  type,
  action,
  isPaused,
}: JobMessageProps) {
  const isError = useMemo(() => type === "error", [type]);
  const isPending = useMemo(() => type === "pending", [type]);
  const isSuccess = useMemo(() => type === "success", [type]);

  return (
    <div className="bg-stone-900 w-[calc(min(100vh,24rem))] rounded-md overflow-hidden">
      <div
        className={clsx(
          "bg-primary/10 overflow-hidden relative h-1",
          isError && "bg-red-500/10 [&_div]:bg-red-500",
          (isSuccess || isPending) && "bg-primary/10 [&_div]:bg-primary",
        )}
      >
        <div
          className={clsx(
            "w-full h-1 absolute left-0",
            isPending && "animate-slide-x",
            !isPending && "animate-shrink-x",
          )}
          style={{
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      </div>
      <div className="flex-1 flex space-x-4 px-4 py-2">
        <div className="size-6 m-auto">
          {isPending && (
            <div
              className="size-6 border-3 border-white border-t-transparent rounded-full animate-spin"
              style={{
                animationPlayState: isPaused ? "paused" : "running",
              }}
            />
          )}
          {isSuccess && (
            <MdCheckCircle
              size={24}
              className="fill-primary animate-bounce-in"
            />
          )}
          {isError && (
            <MdError
              size={24}
              className="fill-red animate-bounce-in"
            />
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium md:text-base">{title}</p>
          {subtitle && (
            <p className="text-white/75 lt-sm:text-xs sm:text-sm">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
});

type BackgroundJobToastProps = {
  jobId: string;
  setJobId: React.Dispatch<React.SetStateAction<string | undefined>>;
  title: string;
  message: {
    success: string;
    error: string;
    pending: string;
  };
  action?: React.ReactNode;
  status?: "success" | "error" | "pending";
};

export default function BackgroundJobToast({
  jobId,
  title,
  setJobId,
  message,
  action,
  status,
}: BackgroundJobToastProps) {
  const created = useRef(false);

  useEffect(() => {
    if (!created.current) {
      toast(
        ({ isPaused }) => (
          <JobMessage
            isPaused={isPaused}
            type="pending"
            title={title}
            action={action}
            subtitle={message.pending}
          />
        ),
        {
          toastId: jobId,
          autoClose: false,
          closeButton: false,
          pauseOnHover: false,
          pauseOnFocusLoss: false,
          onClose: () => setJobId(undefined),
          style: {
            padding: 0,
            background: "none",
          },
        },
      );
      created.current = true;
      return;
    }

    if (status === "error")
      toast.update(jobId, {
        autoClose: 500,
        hideProgressBar: true,
        onClose: () => setJobId(undefined),
        render: ({ isPaused }) => (
          <JobMessage
            type="error"
            action={action}
            title={title}
            isPaused={isPaused}
            subtitle={message.error}
          />
        ),
      });
    else if (status === "success")
      toast.update(jobId, {
        autoClose: 5000,
        hideProgressBar: true,
        onClose: () => setJobId(undefined),
        render: ({ isPaused }) => (
          <JobMessage
            type="success"
            action={action}
            title={title}
            isPaused={isPaused}
            subtitle={message.success}
          />
        ),
      });
  }, [message, title, jobId, action, setJobId, status]);

  return null;
}
