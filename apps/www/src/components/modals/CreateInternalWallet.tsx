import clsx from "clsx";
import { useMemo } from "react";
import { useTRPC } from "@/trpc.client";
import { MdCheck, MdBolt } from "react-icons/md";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from "@headlessui/react";

export default function CreateInternalWallet(
  props: React.ComponentProps<typeof Dialog>,
) {
  const trpc = useTRPC();
  const { updateUser, user } = useAuth();
  const { mutateAsync, isPending } = useMutation(
    trpc.wallet.create.mutationOptions({
      onSuccess(wallet) {
        updateUser({
          wallet,
          wallets: [wallet, ...user.wallets],
        });
        props.onClose?.(false);
      },
    }),
  );

  const features = useMemo(
    () => [
      "Create positions",
      "View and configure automations",
      "Earn bonus Rhiva Points",
      "1-Click rebalance",
    ],
    [],
  );

  return (
    <Dialog
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0 flex lt-sm:items-end sm:items-center sm:justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="flex flex-col space-y-8 bg-dark-secondary p-4 rounded-xl lt-md:min-w-full md:min-w-md">
          <div className="flex flex-col space-y-4">
            <header className="flex flex-col">
              <DialogTitle className="flex items-center">
                <MdBolt size={24} />
                <span className="text-lg font-medium">
                  Delegate Wallet Access
                </span>
              </DialogTitle>
              <Description className="text-base text-white/75">
                Create a delegate wallet. No SOL will be charged.
              </Description>
            </header>
            <div
              className="
                 self-center flex flex-col p-4
                 rounded-xl border
                 [border-image:linear-gradient(to_right,theme(colors.cyan),theme(colors.primary),theme(colors.cyan))_1]
                 [border-image-slice:1]
               "
            >
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center space-x-2"
                >
                  <MdCheck
                    size={18}
                    className="fill-primary"
                  />
                  <p className="text-base">{feature}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-row space-x-2">
            <button
              type="button"
              className="w-3/10  text-primary p-2 rounded-md"
              onClick={async () => props.onClose?.(false)}
            >
              Close
            </button>
            <button
              type="button"
              disabled={isPending}
              className="flex-1 flex items-center justify-center space-x-2 bg-primary text-black p-2 rounded-md"
              onClick={async () =>
                mutateAsync({
                  primary: true,
                })
              }
            >
              {isPending && (
                <div className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              <span>Create</span>
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
