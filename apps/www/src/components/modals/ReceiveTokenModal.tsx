import clsx from "clsx";
import { QRCodeSVG } from "qrcode.react";
import { MdClose } from "react-icons/md";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export default function ReceiveTokenModal(
  props: React.ComponentProps<typeof Dialog>,
) {
  return (
    <Dialog
      {...props}
      className={clsx("relative z-50", props.className)}
    >
      <div className="fixed inset-0 flex items-center justify-center">
        <DialogBackdrop className="absolute inset-0 bg-black/50 -z-10" />
        <DialogPanel className="bg-dark-secondary p-4 rounded-xl lt-md:min-w-9/10 md:min-w-md">
          <header className="flex items-center justify-between py-4">
            <DialogTitle className="text-xl font-bold">Receive</DialogTitle>
            <button
              type="button"
              onClick={() => props.onClose?.(false)}
            >
              <MdClose size={18} />
            </button>
          </header>
          <ReceiveTokenForm />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function ReceiveTokenForm(props: React.ComponentProps<"div">) {
  const { user } = useAuth();

  return (
    user && (
      <div
        {...props}
        className={clsx("flex flex-col  space-y-8", props.className)}
      >
        <div className="relative flex flex-col justify-center">
          <QRCodeSVG
            value={user.wallet.id}
            className="w-full h-full border border-white/10 p-4 rounded-xl"
          />
        </div>
        <div className="flex flex-col space-y-2">
          <p className="text-xs text-gray">
            Only send Solana Network tokens (SPL) to this address
          </p>
          <button
            type="submit"
            className="bg-primary text-black p-3 rounded-md"
          >
            Copy address
          </button>
        </div>
      </div>
    )
  );
}
